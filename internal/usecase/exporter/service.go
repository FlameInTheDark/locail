package exporter

import (
    "context"
    "errors"
    exreg "locail/internal/adapters/exporter/registry"
    "locail/internal/domain"
    "locail/internal/ports"
)

type Service struct {
    Files ports.FileRepository
    Units ports.UnitRepository
    Trans ports.TranslationRepository
    Reg   *exreg.Registry
}

func New(files ports.FileRepository, units ports.UnitRepository, trans ports.TranslationRepository, reg *exreg.Registry) *Service {
    return &Service{Files: files, Units: units, Trans: trans, Reg: reg}
}

type ExportArgs struct {
    FileID   int64
    Locale   string
    Fallback bool
    OverrideFormat string // optional
    LanguageName   string // optional for VDF header
}

type ExportResult struct {
    Filename string
    Content  []byte
}

func (s *Service) ExportFile(ctx context.Context, a ExportArgs) (ExportResult, error) {
    f, err := s.Files.Get(ctx, a.FileID)
    if err != nil { return ExportResult{}, err }
    format := f.Format
    if a.OverrideFormat != "" { format = a.OverrideFormat }
    exp, ok := s.Reg.Get(format)
    if !ok { return ExportResult{}, errors.New("no exporter for format: "+format) }
    units, err := s.Units.ListByFile(ctx, f.ID)
    if err != nil { return ExportResult{}, err }
    trList, err := s.Trans.ListByFileLocale(ctx, f.ID, a.Locale)
    if err != nil { return ExportResult{}, err }
    trByUnit := map[int64]*domain.Translation{}
    for _, t := range trList { trByUnit[t.UnitID] = t }
    items := make([]ports.ExportItem, 0, len(units))
    for _, u := range units {
        text := ""
        if t, ok := trByUnit[u.ID]; ok { text = t.Text }
        items = append(items, ports.ExportItem{Key: u.Key, SourceText: u.SourceText, Translation: text})
    }
    lang := a.LanguageName
    if lang == "" { lang = a.Locale }
    content, err := exp.Export(lang, items)
    if err != nil { return ExportResult{}, err }
    name := f.Path
    return ExportResult{Filename: name, Content: content}, nil
}

