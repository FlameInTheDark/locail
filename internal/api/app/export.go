package app

import (
    "context"
    "encoding/base64"
    exreg "locail/internal/adapters/exporter/registry"
    csvexp "locail/internal/adapters/exporter/csv"
    jsonexp "locail/internal/adapters/exporter/paraglidejson"
    vdfexp "locail/internal/adapters/exporter/valvevdf"
    "locail/internal/usecase/exporter"
)

type ExportAPI struct { svc *exporter.Service }

func NewExportAPI(s *exporter.Service) *ExportAPI { return &ExportAPI{svc: s} }

type ExportFileRequest struct {
    FileID int64 `json:"file_id"`
    Locale string `json:"locale"`
    OverrideFormat string `json:"override_format"`
    LanguageName string `json:"language_name"`
}

type ExportFileResponse struct {
    Filename string `json:"filename"`
    ContentB64 string `json:"content_b64"`
}

func (a *ExportAPI) ExportFileBase64(req ExportFileRequest) (ExportFileResponse, error) {
    ctx := context.Background()
    res, err := a.svc.ExportFile(ctx, exporter.ExportArgs{FileID: req.FileID, Locale: req.Locale, OverrideFormat: req.OverrideFormat, LanguageName: req.LanguageName})
    if err != nil { return ExportFileResponse{}, err }
    return ExportFileResponse{Filename: res.Filename, ContentB64: base64.StdEncoding.EncodeToString(res.Content)}, nil
}

// Helper to build default exporter registry
func NewDefaultExporterRegistry() *exreg.Registry {
    reg := exreg.New()
    reg.Register(jsonexp.New())
    reg.Register(vdfexp.New())
    reg.Register(csvexp.New())
    return reg
}
