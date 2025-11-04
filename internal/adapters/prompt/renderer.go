package prompt

import (
    "bytes"
    "context"
    "text/template"
    "locail/internal/ports"
)

type Renderer struct {
    Templates ports.TemplateRepository
}

func New(templates ports.TemplateRepository) *Renderer { return &Renderer{Templates: templates} }

func (r *Renderer) Render(ctx context.Context, scope string, refID *int64, typ, role string, data ports.PromptData) (string, error) {
    // Load effective template from repository; if none, fallback to builtins.
    t, _ := r.Templates.GetEffective(ctx, scope, refID, typ, role)
    body := builtinTemplate(typ, role)
    if t != nil && t.Body != "" {
        body = t.Body
    }
    tpl, err := template.New("prompt").Parse(body)
    if err != nil { return "", err }
    var buf bytes.Buffer
    if err := tpl.Execute(&buf, data); err != nil { return "", err }
    return buf.String(), nil
}

func builtinTemplate(typ, role string) string {
    if typ == "translate_single" && role == "system" {
        return "You are a professional localization translator. Translate from {{.SrcLang}} to {{.TgtLang}}. Preserve placeholders exactly (e.g., {{.Placeholders}}) and Valve tags like <sfx>, <clr:...>. Do not change whitespace or punctuation. Return only JSON: {\"translation\":\"...\"}."
    }
    if typ == "translate_single" && role == "user" {
        return "project: {{.Project}} file: {{.FilePath}} key: {{.Key}} context: {{.Context}}\nsource: {{.Text}}"
    }
    if typ == "detect_language" && role == "system" {
        return "Identify the ISO 639-1 language code of the text. Return only JSON: {\"language\":\"<code>\"}."
    }
    if typ == "detect_language" && role == "user" {
        return "text: {{.Text}}"
    }
    return ""
}

