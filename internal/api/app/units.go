package app

import (
    "context"
    "errors"
    "locail/internal/domain"
    "locail/internal/ports"
)

type UnitAPI struct { repo ports.UnitRepository }

func NewUnitAPI(repo ports.UnitRepository) *UnitAPI { return &UnitAPI{repo: repo} }

func (a *UnitAPI) ListByFile(fileID int64) ([]*domain.Unit, error) {
    ctx := context.Background()
    return a.repo.ListByFile(ctx, fileID)
}

type UpsertItem struct { Key string `json:"key"`; Source string `json:"source"`; Context string `json:"context"`; Metadata string `json:"metadata_json"` }

// UpsertBatch inserts new units and updates existing units' source/context by key for the given file.
func (a *UnitAPI) UpsertBatch(fileID int64, items []UpsertItem) (int, error) {
    ctx := context.Background()
    if fileID == 0 { return 0, errors.New("file_id required") }
    ups := make([]*domain.Unit, 0, len(items))
    for _, it := range items {
        ups = append(ups, &domain.Unit{FileID: fileID, Key: it.Key, SourceText: it.Source, Context: it.Context, MetadataRaw: it.Metadata})
    }
    if err := a.repo.UpsertBatch(ctx, ups); err != nil { return 0, err }
    return len(ups), nil
}
