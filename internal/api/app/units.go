package app

import (
    "context"
    "locail/internal/domain"
    "locail/internal/ports"
)

type UnitAPI struct { repo ports.UnitRepository }

func NewUnitAPI(repo ports.UnitRepository) *UnitAPI { return &UnitAPI{repo: repo} }

func (a *UnitAPI) ListByFile(fileID int64) ([]*domain.Unit, error) {
    ctx := context.Background()
    return a.repo.ListByFile(ctx, fileID)
}
