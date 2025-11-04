package ollama

import (
    "context"
    "errors"
    "locail/internal/ports"
)

type Client struct {
    BaseURL string
    Model   string
}

func New(baseURL, model string) *Client {
    return &Client{BaseURL: baseURL, Model: model}
}

func (c *Client) Translate(ctx context.Context, seg ports.Segment, p ports.TranslateParams) (ports.TranslateResult, error) {
    return ports.TranslateResult{}, errors.New("ollama translate: not implemented yet")
}

func (c *Client) ListModels(ctx context.Context) ([]ports.ModelInfo, error) {
    return nil, errors.New("ollama list models: not implemented yet")
}

func (c *Client) Test(ctx context.Context) error {
    return errors.New("ollama test: not implemented yet")
}

