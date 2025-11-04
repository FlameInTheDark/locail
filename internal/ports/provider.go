package ports

import (
    "context"
)

type Segment struct {
    Key          string
    Text         string
    Context      string
    Placeholders []string
    Tags         []string
}

type TranslateParams struct {
    SourceLang  string
    TargetLang  string
    Model       string
    Temperature float64
    SystemPrompt string
    UserPrompt   string
}

type TranslateResult struct {
    Translation string
    Raw         string
}

type ModelInfo struct {
    Name         string
    Description  string
    ContextTokens int
}

// Provider represents a single LLM provider implementation.
type Provider interface {
    Translate(ctx context.Context, seg Segment, p TranslateParams) (TranslateResult, error)
    ListModels(ctx context.Context) ([]ModelInfo, error)
    Test(ctx context.Context) error
}

