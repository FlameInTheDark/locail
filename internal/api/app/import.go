package app

import (
	"context"
	"encoding/base64"
	"errors"
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
	if err != nil {
		return ImportResponse{}, err
	}
	res, err := a.svc.Import(ctx, importer.ImportArgs{
		ProjectID: req.ProjectID,
		Filename:  req.Filename,
		Format:    req.Format,
		Locale:    req.Locale,
		Content:   b,
	})
	if err != nil {
		return ImportResponse{}, err
	}
	return ImportResponse{FileID: res.FileID, Units: res.Units}, nil
}

// ParseBase64 parses the content using the requested parser and returns the units without persisting.
type UnitKV struct {
	Key     string `json:"key"`
	Source  string `json:"source"`
	Context string `json:"context,omitempty"`
}
type ParseResponse struct {
	Locale string   `json:"locale"`
	Items  []UnitKV `json:"items"`
}

func (a *ImportAPI) ParseBase64(req ImportRequest) (ParseResponse, error) {
	b, err := base64.StdEncoding.DecodeString(req.ContentB64)
	if err != nil {
		return ParseResponse{}, err
	}
	parser, ok := a.svc.ParserRegistry.Get(req.Format)
	if !ok {
		return ParseResponse{}, errors.New("unsupported format: " + req.Format)
	}
	pr, err := parser.Parse(b)
	if err != nil {
		return ParseResponse{}, err
	}
	items := make([]UnitKV, 0, len(pr.Units))
	for _, u := range pr.Units {
		items = append(items, UnitKV{Key: u.Key, Source: u.SourceText, Context: u.Context})
	}
	return ParseResponse{Locale: pr.Locale, Items: items}, nil
}

// Helper to create a default parser registry for wiring.
func NewDefaultParserRegistry() *parreg.Registry {
	reg := parreg.New()
	reg.Register(paraglide.New())
	reg.Register(vdf.New())
	reg.Register(csvp.New())
	return reg
}
