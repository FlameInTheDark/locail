package app

import (
    "context"
    "encoding/base64"
    csvp "locail/internal/adapters/parser/csv"
    paraglide "locail/internal/adapters/parser/paraglidejson"
    parreg "locail/internal/adapters/parser/registry"
    vdf "locail/internal/adapters/parser/valvevdf"
    "locail/internal/usecase/importer"
)

type ImportAPI struct {
    svc *importer.Service
}

func NewImportAPI(svc *importer.Service) *ImportAPI { return &ImportAPI{svc: svc} }

type ImportRequest struct {
    ProjectID int64  `json:"project_id"`
    Filename  string `json:"filename"`
    Format    string `json:"format"`
    Locale    string `json:"locale"`
    // Content is base64-encoded text bytes
    ContentB64 string `json:"content_b64"`
}

type ImportResponse struct {
    FileID int64 `json:"file_id"`
    Units  int   `json:"units"`
}

func (a *ImportAPI) ImportBase64(req ImportRequest) (ImportResponse, error) {
    ctx := context.Background()
    b, err := base64.StdEncoding.DecodeString(req.ContentB64)
    if err != nil { return ImportResponse{}, err }
    res, err := a.svc.Import(ctx, importer.ImportArgs{ProjectID: req.ProjectID, Filename: req.Filename, Format: req.Format, Locale: req.Locale, Content: b})
    if err != nil { return ImportResponse{}, err }
    return ImportResponse{FileID: res.FileID, Units: res.Units}, nil
}

// Helper to create a default parser registry for wiring.
func NewDefaultParserRegistry() *parreg.Registry {
    reg := parreg.New()
    reg.Register(paraglide.New())
    reg.Register(vdf.New())
    reg.Register(csvp.New())
    return reg
}
