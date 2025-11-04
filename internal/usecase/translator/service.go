package translator

import (
    "context"
    "errors"
    "fmt"
    "regexp"
    "sort"
    "strings"
    "time"
    "locail/internal/domain"
    "locail/internal/ports"
)

type Deps struct {
    Providers   ports.ProviderRepository
    Templates   ports.TemplateRepository
    Cache       ports.CacheRepository
    Translations ports.TranslationRepository
    Prompt      ports.PromptRenderer
    // BuildProvider should return a concrete ports.Provider for a given provider record
    BuildProvider func(*domain.Provider) (ports.Provider, error)
}

type Service struct { d Deps }

func New(d Deps) *Service { return &Service{d: d} }

type TranslateArgs struct {
    ProviderID int64
    Unit       *domain.Unit
    SourceLang string
    TargetLang string
    Model      string
    SystemOverride string
    UserOverride   string
}

func (s *Service) TranslateOne(ctx context.Context, a TranslateArgs) (string, error) {
    if a.Unit == nil { return "", errors.New("unit is required") }
    prov, err := s.d.Providers.Get(ctx, a.ProviderID)
    if err != nil { return "", err }
    // Build prompt data and render templates (translate_single)
    ph := extractPlaceholders(a.Unit.SourceText)
    tags := extractValveTags(a.Unit.SourceText)
    // Mask placeholders/tags before calling provider (and include masked text in user prompt)
    masked, unmask := maskTokens(a.Unit.SourceText, ph, tags)
    data := ports.PromptData{SrcLang: a.SourceLang, TgtLang: a.TargetLang, Key: a.Unit.Key, Text: masked, FilePath: "", Project: "", Context: a.Unit.Context, Placeholders: ph, Tags: tags}
    system := a.SystemOverride
    user := a.UserOverride
    if system == "" {
        system, err = s.d.Prompt.Render(ctx, "provider", &prov.ID, "translate_single", "system", data)
        if err != nil { return "", err }
    }
    if user == "" {
        user, err = s.d.Prompt.Render(ctx, "provider", &prov.ID, "translate_single", "user", data)
        if err != nil { return "", err }
    }
    seg := ports.Segment{Key: a.Unit.Key, Text: masked, Context: a.Unit.Context, Placeholders: ph, Tags: tags}

    // Cache lookup (masked variant to protect placeholders)
    if ce, _ := s.d.Cache.Get(ctx, masked, a.SourceLang, a.TargetLang, prov.Type, a.Model); ce != nil {
        out := unmask(ce.Translation)
        return out, nil
    }

    // Build provider and execute translation
    if s.d.BuildProvider == nil { return "", fmt.Errorf("TranslateOne: provider builder missing") }
    adapter, err := s.d.BuildProvider(prov)
    if err != nil { return "", err }
    var res ports.TranslateResult
    var trErr error
    for attempt := 1; attempt <= 3; attempt++ {
        res, trErr = adapter.Translate(ctx, seg, ports.TranslateParams{SourceLang: a.SourceLang, TargetLang: a.TargetLang, Model: a.Model, Temperature: 0.0, SystemPrompt: system, UserPrompt: user})
        if trErr == nil { break }
        // Retry only on parse/formatting errors that models often flake on
        if !isRetryableTranslateError(trErr) || attempt == 3 {
            return "", trErr
        }
        // small backoff
        time.Sleep(time.Duration(200*attempt) * time.Millisecond)
    }
    translated := unmask(strings.TrimSpace(res.Translation))
    // Basic validation: ensure all placeholders/tags present
    for _, phv := range ph { if !strings.Contains(translated, phv) { return "", fmt.Errorf("placeholder missing in translation: %s", phv) } }
    for _, tg := range tags { if !strings.Contains(translated, tg) { return "", fmt.Errorf("tag missing in translation: %s", tg) } }
    // Save cache
    _ = s.d.Cache.Put(ctx, &domain.CacheEntry{SourceText: masked, SrcLang: a.SourceLang, TgtLang: a.TargetLang, Provider: prov.Type, Model: a.Model, Translation: translated})
    return translated, nil
}

var placeholderRE = regexp.MustCompile(`\{[^}]+\}`)
var valveTagRE = regexp.MustCompile(`<[^>]+>`)

func extractPlaceholders(s string) []string {
    m := placeholderRE.FindAllString(s, -1)
    if len(m) == 0 { return nil }
    uniq := make(map[string]struct{}, len(m))
    for _, v := range m { uniq[v] = struct{}{} }
    out := make([]string, 0, len(uniq))
    for v := range uniq { out = append(out, v) }
    sort.Strings(out)
    return out
}

func extractValveTags(s string) []string {
    m := valveTagRE.FindAllString(s, -1)
    if len(m) == 0 { return nil }
    uniq := make(map[string]struct{}, len(m))
    for _, v := range m { uniq[v] = struct{}{} }
    out := make([]string, 0, len(uniq))
    for v := range uniq { out = append(out, v) }
    sort.Strings(out)
    return out
}

func maskTokens(s string, placeholders, tags []string) (string, func(string) string) {
    masked := s
    repls := []struct{ from, to string }{}
    // Replace placeholders first
    for i, ph := range placeholders {
        token := fmt.Sprintf("__PH_%d__", i)
        masked = strings.ReplaceAll(masked, ph, token)
        repls = append(repls, struct{ from, to string }{from: token, to: ph})
    }
    // Then tags
    for i, tg := range tags {
        token := fmt.Sprintf("__TAG_%d__", i)
        masked = strings.ReplaceAll(masked, tg, token)
        repls = append(repls, struct{ from, to string }{from: token, to: tg})
    }
    unmask := func(in string) string {
        out := in
        // restore in reverse order
        for i := len(repls) - 1; i >= 0; i-- {
            out = strings.ReplaceAll(out, repls[i].from, repls[i].to)
        }
        return out
    }
    return masked, unmask
}

// isRetryableTranslateError returns true for transient output/format issues that
// are likely to succeed on retry (e.g., invalid/missing JSON in model response).
func isRetryableTranslateError(err error) bool {
    if err == nil { return false }
    msg := strings.ToLower(err.Error())
    switch {
    case strings.Contains(msg, "failed to parse translation json"):
        return true
    case strings.Contains(msg, "no choices returned"):
        return true
    case strings.Contains(msg, "unexpected end of"):
        return true
    case strings.Contains(msg, "invalid character"):
        return true
    default:
        return false
    }
}
