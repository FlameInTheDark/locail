package app

import (
	"context"
	"errors"
	"locail/internal/adapters/llm/factory"
	"locail/internal/domain"
	"locail/internal/ports"
	"strings"
)

type ProviderAPI struct {
	repo ports.ProviderRepository
}

func NewProviderAPI(repo ports.ProviderRepository) *ProviderAPI { return &ProviderAPI{repo: repo} }

func (a *ProviderAPI) Create(p domain.Provider) (*domain.Provider, error) {
	ctx := context.Background()
	if p.Type == "" || p.Name == "" {
		return nil, errors.New("type and name are required")
	}
	// Normalize model identifiers where needed (e.g., OpenRouter)
	_ = a.normalizeModel(ctx, &p)
	if err := a.repo.Create(ctx, &p); err != nil {
		return nil, err
	}
	// mask API key when returning
	p.APIKey = mask(p.APIKey)
	return &p, nil
}

func (a *ProviderAPI) Update(p domain.Provider) (*domain.Provider, error) {
	ctx := context.Background()
	if p.ID == 0 {
		return nil, errors.New("id is required")
	}
	// Preserve existing API key if masked or empty provided from UI
	if strings.HasPrefix(p.APIKey, "****") || p.APIKey == "" {
		existing, err := a.repo.Get(ctx, p.ID)
		if err != nil {
			return nil, err
		}
		p.APIKey = existing.APIKey
	}
	// Normalize model identifiers where needed (e.g., OpenRouter)
	_ = a.normalizeModel(ctx, &p)
	if err := a.repo.Update(ctx, &p); err != nil {
		return nil, err
	}
	p.APIKey = mask(p.APIKey)
	return &p, nil
}

func (a *ProviderAPI) List() ([]*domain.Provider, error) {
	ctx := context.Background()
	list, err := a.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	for _, p := range list {
		p.APIKey = mask(p.APIKey)
	}
	return list, nil
}

type ModelInfo struct {
	Name, Description string
	ContextTokens     int
}

func (a *ProviderAPI) ListModels(id int64) ([]ModelInfo, error) {
	ctx := context.Background()
	p, err := a.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	prov, ok := factory.FromProvider(p)
	if !ok {
		return nil, errors.New("unsupported provider type")
	}
	models, err := prov.ListModels(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ModelInfo, 0, len(models))
	for _, m := range models {
		out = append(out, ModelInfo{
			Name:          m.Name,
			Description:   m.Description,
			ContextTokens: m.ContextTokens,
		})
	}
	return out, nil
}

// ProviderTestResult contains details of a connectivity/translate test.
type ProviderTestResult struct {
	Ok          bool   `json:"ok"`
	Translation string `json:"translation,omitempty"`
	Raw         string `json:"raw,omitempty"`
	Error       string `json:"error,omitempty"`
}

// Test performs a live translation of a simple phrase to validate a provider.
// It attempts to translate "hello" from English to Russian using the provider's default model.
// On failure, it returns the error string which should include HTTP status and body when available.
func (a *ProviderAPI) Test(id int64) (ProviderTestResult, error) {
	ctx := context.Background()
	p, err := a.repo.Get(ctx, id)
	if err != nil {
		return ProviderTestResult{}, err
	}
	prov, ok := factory.FromProvider(p)
	if !ok {
		return ProviderTestResult{}, errors.New("unsupported provider type")
	}
	// Normalize transiently for the test (do not persist)
	_ = a.normalizeModel(ctx, p)

	// Build minimal prompts to enforce JSON output
	system := "You are a professional localization translator. Translate from en to ru. Preserve placeholders/tags. Return only JSON: {\"translation\":\"...\"}."
	user := "Text: hello"

	seg := ports.Segment{
		Key:  "test",
		Text: "hello",
	}

	res, trErr := prov.Translate(ctx, seg, ports.TranslateParams{
		SourceLang:   "en",
		TargetLang:   "ru",
		Model:        p.Model,
		Temperature:  0.0,
		SystemPrompt: system,
		UserPrompt:   user,
	})
	if trErr != nil {
		return ProviderTestResult{
			Ok:    false,
			Error: trErr.Error(),
		}, nil
	}
	return ProviderTestResult{
		Ok:          true,
		Translation: res.Translation,
		Raw:         res.Raw,
	}, nil
}

// normalizeModel attempts to convert human-readable model labels to canonical IDs
// for providers that expose both (e.g., OpenRouter). It best-effort updates p.Model in place.
func (a *ProviderAPI) normalizeModel(ctx context.Context, p *domain.Provider) error {
	if p == nil {
		return nil
	}
	if strings.ToLower(p.Type) != "openrouter" {
		return nil
	}
	m := strings.TrimSpace(p.Model)
	if m == "" {
		return nil
	}
	// Heuristic: labels often contain spaces/parentheses; IDs rarely do.
	if !strings.Contains(m, " ") && !strings.Contains(m, "(") && !strings.Contains(m, ")") {
		return nil // likely already an ID
	}
	prov, ok := factory.FromProvider(p)
	if !ok {
		return nil
	}
	models, err := prov.ListModels(ctx)
	if err != nil {
		return err
	}
	for _, mi := range models {
		if strings.EqualFold(mi.Name, m) || strings.EqualFold(mi.Description, m) {
			p.Model = mi.Name
			return nil
		}
	}
	return nil
}

func (a *ProviderAPI) Delete(id int64) (bool, error) {
	ctx := context.Background()
	if err := a.repo.Delete(ctx, id); err != nil {
		return false, err
	}
	return true, nil
}

// ListModelsPreview returns models for a transient provider configuration
// without persisting it. Useful for configuring a provider before saving.
func (a *ProviderAPI) ListModelsPreview(p domain.Provider) ([]ModelInfo, error) {
	ctx := context.Background()
	prov, ok := factory.FromProvider(&p)
	if !ok {
		return nil, errors.New("unsupported provider type")
	}
	models, err := prov.ListModels(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ModelInfo, 0, len(models))
	for _, m := range models {
		out = append(out, ModelInfo{
			Name:          m.Name,
			Description:   m.Description,
			ContextTokens: m.ContextTokens,
		})
	}
	return out, nil
}

func mask(s string) string {
	if len(s) <= 4 {
		return s
	}
	return "****" + s[len(s)-4:]
}
