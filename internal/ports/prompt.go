package ports

import "context"

type PromptData struct {
    SrcLang     string
    TgtLang     string
    Key         string
    Text        string
    FilePath    string
    Project     string
    Context     string
    Placeholders []string
    Tags         []string
}

type PromptRenderer interface {
    Render(ctx context.Context, scope string, refID *int64, typ, role string, data PromptData) (string, error)
}

