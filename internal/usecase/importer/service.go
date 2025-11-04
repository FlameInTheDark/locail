package importer

import (
    "context"
    "crypto/sha256"
    "encoding/hex"
    "errors"
    parreg "locail/internal/adapters/parser/registry"
    "locail/internal/domain"
    "locail/internal/ports"
)

type Service struct {
    Files ports.FileRepository
    Units ports.UnitRepository
    ParserRegistry *parreg.Registry
}

func New(files ports.FileRepository, units ports.UnitRepository, reg *parreg.Registry) *Service {
    return &Service{Files: files, Units: units, ParserRegistry: reg}
}

type ImportArgs struct {
    ProjectID int64
    Filename  string
    Format    string
    Locale    string
    Content   []byte
}

type ImportResult struct {
    FileID int64
    Units  int
}

func (s *Service) Import(ctx context.Context, in ImportArgs) (ImportResult, error) {
    parser, ok := s.ParserRegistry.Get(in.Format)
    if !ok {
        return ImportResult{}, errors.New("unsupported format: " + in.Format)
    }
    pr, err := parser.Parse(in.Content)
    if err != nil { return ImportResult{}, err }
    sum := sha256.Sum256(in.Content)
    f := &domain.File{ProjectID: in.ProjectID, Path: in.Filename, Format: in.Format, Locale: in.Locale, Hash: hex.EncodeToString(sum[:])}
    if err := s.Files.Create(ctx, f); err != nil { return ImportResult{}, err }
    for _, u := range pr.Units {
        u.FileID = f.ID
    }
    if err := s.Units.UpsertBatch(ctx, pr.Units); err != nil { return ImportResult{}, err }
    return ImportResult{FileID: f.ID, Units: len(pr.Units)}, nil
}
