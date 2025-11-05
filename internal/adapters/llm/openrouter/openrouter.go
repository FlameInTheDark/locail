package openrouter

import (
	"context"
	"errors"
	"locail/internal/ports"
)

type Client struct {
	APIKey  string
	BaseURL string
	Model   string
}

func New(apiKey, baseURL, model string) *Client {
	return &Client{APIKey: apiKey, BaseURL: baseURL, Model: model}
}

func (c *Client) Translate(ctx context.Context, seg ports.Segment, p ports.TranslateParams) (ports.TranslateResult, error) {
	return ports.TranslateResult{}, errors.New("openrouter translate: not implemented yet")
}

func (c *Client) ListModels(ctx context.Context) ([]ports.ModelInfo, error) {
	return nil, errors.New("openrouter list models: not implemented yet")
}

func (c *Client) Test(ctx context.Context) error {
	return errors.New("openrouter test: not implemented yet")
}
