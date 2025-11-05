package httpclient

import (
	"context"
	"encoding/json"
	"fmt"
	"locail/internal/ports"
	"regexp"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
)

type Client struct {
	ProviderType string
	APIKey       string
	BaseURL      string
	Model        string
	http         *resty.Client
}

func New(providerType, apiKey, baseURL, model string) *Client {
	// Increase default HTTP timeout to 30s to accommodate slower local/remote providers
	c := resty.New().SetTimeout(30 * time.Second)
	return &Client{ProviderType: strings.ToLower(providerType), APIKey: apiKey, BaseURL: baseURL, Model: model, http: c}
}

func (c *Client) Translate(ctx context.Context, seg ports.Segment, p ports.TranslateParams) (ports.TranslateResult, error) {
	switch c.ProviderType {
	case "openrouter":
		return c.translateOpenRouter(ctx, p)
	case "ollama":
		return c.translateOllama(ctx, p)
	default:
		return ports.TranslateResult{}, fmt.Errorf("unsupported provider: %s", c.ProviderType)
	}
}

func (c *Client) ListModels(ctx context.Context) ([]ports.ModelInfo, error) {
	switch c.ProviderType {
	case "ollama":
		base := c.BaseURL
		if base == "" {
			base = "http://localhost:11434"
		}
		url := strings.TrimRight(base, "/") + "/api/tags"
		var resp struct {
			Models []struct {
				Name string `json:"name"`
			} `json:"models"`
		}
		r, err := c.http.R().SetContext(ctx).SetResult(&resp).Get(url)
		if err != nil {
			return nil, err
		}
		if r.IsError() {
			return nil, fmt.Errorf("ollama list models: %s; body: %s", r.Status(), r.String())
		}
		out := make([]ports.ModelInfo, 0, len(resp.Models))
		for _, m := range resp.Models {
			out = append(out, ports.ModelInfo{Name: m.Name})
		}
		return out, nil
	case "openrouter":
		base := c.BaseURL
		if base == "" {
			base = "https://openrouter.ai"
		}
		url := openRouterURL(base, "/models")
		var resp struct {
			Data []struct {
				ID            string `json:"id"`
				Name          string `json:"name"`
				ContextLength int    `json:"context_length"`
			} `json:"data"`
		}
		r := c.http.R().SetContext(ctx).
			SetHeader("Authorization", "Bearer "+c.APIKey).
			SetResult(&resp)
		rr, err := r.Get(url)
		if err != nil {
			return nil, err
		}
		if rr.IsError() {
			return nil, fmt.Errorf("openrouter list models: %s; body: %s", rr.Status(), rr.String())
		}
		out := make([]ports.ModelInfo, 0, len(resp.Data))
		for _, d := range resp.Data {
			label := d.Name
			if label == "" {
				label = d.ID
			}
			out = append(out, ports.ModelInfo{Name: d.ID, Description: label, ContextTokens: d.ContextLength})
		}
		return out, nil
	default:
		return nil, fmt.Errorf("unsupported provider: %s", c.ProviderType)
	}
}

func (c *Client) Test(ctx context.Context) error { _, err := c.ListModels(ctx); return err }

func (c *Client) translateOpenRouter(ctx context.Context, p ports.TranslateParams) (ports.TranslateResult, error) {
	base := c.BaseURL
	if base == "" {
		base = "https://openrouter.ai"
	}
	url := openRouterURL(base, "/chat/completions")
	model := p.Model
	if model == "" {
		model = c.Model
	}
	// Prefer JSON schema for stronger structured output; fallback to json_object if 400
	type message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	type schemaProps struct {
		Type string `json:"type"`
	}
	type schemaDef struct {
		Type                 string                 `json:"type"`
		Properties           map[string]schemaProps `json:"properties"`
		Required             []string               `json:"required"`
		AdditionalProperties bool                   `json:"additionalProperties"`
	}
	type responseJSONSchema struct {
		Name   string    `json:"name"`
		Strict bool      `json:"strict"`
		Schema schemaDef `json:"schema"`
	}
	type responseFormat struct {
		Type       string             `json:"type"`
		JSONSchema responseJSONSchema `json:"json_schema"`
	}
	type requestBody struct {
		Model          string    `json:"model"`
		Messages       []message `json:"messages"`
		Temperature    float64   `json:"temperature"`
		ResponseFormat any       `json:"response_format"`
	}
	schema := responseFormat{
		Type: "json_schema",
		JSONSchema: responseJSONSchema{
			Name:   "translation",
			Strict: true,
			Schema: schemaDef{
				Type:                 "object",
				Properties:           map[string]schemaProps{"translation": {Type: "string"}},
				Required:             []string{"translation"},
				AdditionalProperties: false,
			},
		},
	}
	body := requestBody{
		Model:          model,
		Messages:       []message{{Role: "system", Content: p.SystemPrompt}, {Role: "user", Content: p.UserPrompt}},
		Temperature:    p.Temperature,
		ResponseFormat: schema,
	}
	var resp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	r := c.http.R().SetContext(ctx).
		SetHeader("Authorization", "Bearer "+c.APIKey).
		SetHeader("HTTP-Referer", "https://locail.app").
		SetHeader("X-Title", "locail").
		SetHeader("Content-Type", "application/json").
		SetBody(body).SetResult(&resp)
	rr, err := r.Post(url)
	if err != nil {
		return ports.TranslateResult{}, err
	}
	if rr.IsError() {
		// Fallback to json_object if schema is not supported
		if rr.StatusCode() == 400 {
			body.ResponseFormat = struct {
				Type string `json:"type"`
			}{Type: "json_object"}
			r = c.http.R().SetContext(ctx).
				SetHeader("Authorization", "Bearer "+c.APIKey).
				SetHeader("HTTP-Referer", "https://locail.app").
				SetHeader("X-Title", "locail").
				SetHeader("Content-Type", "application/json").
				SetBody(body).SetResult(&resp)
			rr2, err2 := r.Post(url)
			if err2 != nil {
				return ports.TranslateResult{}, err2
			}
			if rr2.IsError() {
				return ports.TranslateResult{}, fmt.Errorf("openrouter translate: %s; body: %s", rr2.Status(), rr2.String())
			}
		} else {
			return ports.TranslateResult{}, fmt.Errorf("openrouter translate: %s; body: %s", rr.Status(), rr.String())
		}
	}
	if len(resp.Choices) == 0 {
		return ports.TranslateResult{}, fmt.Errorf("no choices returned")
	}
	content := strings.TrimSpace(resp.Choices[0].Message.Content)
	tr, err := extractTranslation(content)
	if err != nil {
		return ports.TranslateResult{}, err
	}
	return ports.TranslateResult{Translation: tr, Raw: content}, nil
}

func (c *Client) translateOllama(ctx context.Context, p ports.TranslateParams) (ports.TranslateResult, error) {
	base := c.BaseURL
	if base == "" {
		base = "http://localhost:11434"
	}
	url := strings.TrimRight(base, "/") + "/api/chat"
	model := p.Model
	if model == "" {
		model = c.Model
	}
	type ollamaMsg struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	type ollamaOptions struct {
		Temperature float64 `json:"temperature"`
	}
	type ollamaBody struct {
		Model    string        `json:"model"`
		Messages []ollamaMsg   `json:"messages"`
		Stream   bool          `json:"stream"`
		Format   string        `json:"format"`
		Options  ollamaOptions `json:"options"`
	}
	body := ollamaBody{
		Model:    model,
		Messages: []ollamaMsg{{Role: "system", Content: p.SystemPrompt}, {Role: "user", Content: p.UserPrompt}},
		Stream:   false,
		Format:   "json",
		Options:  ollamaOptions{Temperature: p.Temperature},
	}
	var resp struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	r := c.http.R().SetContext(ctx).SetHeader("Content-Type", "application/json").SetBody(body).SetResult(&resp)
	rr, err := r.Post(url)
	if err != nil {
		return ports.TranslateResult{}, err
	}
	if rr.IsError() {
		return ports.TranslateResult{}, fmt.Errorf("ollama translate: %s; body: %s", rr.Status(), rr.String())
	}
	content := strings.TrimSpace(resp.Message.Content)
	tr, err := extractTranslation(content)
	if err != nil {
		return ports.TranslateResult{}, err
	}
	return ports.TranslateResult{Translation: tr, Raw: content}, nil
}

var translationRE = regexp.MustCompile(`(?s)\"translation\"\s*:\s*\"(.*?)\"`)

func extractTranslation(content string) (string, error) {
	s := strings.TrimSpace(content)
	// If content contains fenced code, try to extract inner block
	if idx := strings.Index(s, "```"); idx >= 0 {
		rest := s[idx+3:]
		// Strip optional language token like `json`
		rest = strings.TrimPrefix(rest, "json")
		if j := strings.Index(rest, "```"); j >= 0 {
			s = strings.TrimSpace(rest[:j])
		}
	}
	// Try direct JSON first
	var obj struct {
		Translation string `json:"translation"`
	}
	if err := json.Unmarshal([]byte(s), &obj); err == nil && obj.Translation != "" {
		return obj.Translation, nil
	}
	// Regex fallback
	if m := translationRE.FindStringSubmatch(s); len(m) == 2 {
		t := strings.ReplaceAll(m[1], `\n`, "\n")
		t = strings.ReplaceAll(t, `\"`, `"`)
		return t, nil
	}
	// Try to locate a JSON object within surrounding text
	if i := strings.Index(s, "{"); i >= 0 {
		if j := strings.LastIndex(s, "}"); j > i {
			inner := s[i : j+1]
			if err := json.Unmarshal([]byte(inner), &obj); err == nil && obj.Translation != "" {
				return obj.Translation, nil
			}
			if m := translationRE.FindStringSubmatch(inner); len(m) == 2 {
				t := strings.ReplaceAll(m[1], `\n`, "\n")
				t = strings.ReplaceAll(t, `\"`, `"`)
				return t, nil
			}
		}
	}
	// Heuristics: accept plain text answer when JSON mode not respected
	if !strings.Contains(s, "{") {
		// If there's a leading label like "Translation:" remove it
		lower := strings.ToLower(s)
		for _, k := range []string{"translation:", "translated:", "result:", "output:"} {
			if pos := strings.Index(lower, k); pos >= 0 && pos < 80 {
				cand := strings.TrimSpace(s[pos+len(k):])
				if cand != "" {
					return cand, nil
				}
			}
		}
		if s != "" {
			return s, nil
		}
	}
	return "", fmt.Errorf("failed to parse translation JSON; content: %s", abbreviate(s, 2000))
}

func abbreviate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	if n <= 3 {
		return s[:n]
	}
	return s[:n-3] + "..."
}

// openRouterURL builds a URL for OpenRouter whether base contains /api/v1 or not.
func openRouterURL(base, tail string) string {
	b := strings.TrimRight(base, "/")
	// If base already ends with /api/v1 or /api/v1/..., don't duplicate
	if strings.Contains(b, "/api/v1") {
		// ensure it ends with /api/v1
		idx := strings.Index(b, "/api/v1")
		b = b[:idx+len("/api/v1")]
		return b + tail
	}
	return b + "/api/v1" + tail
}
