package app

import (
	"context"
	"locail/internal/domain"
	"locail/internal/ports"
)

type FileAPI struct{ repo ports.FileRepository }

func NewFileAPI(repo ports.FileRepository) *FileAPI { return &FileAPI{repo: repo} }

func (a *FileAPI) ListByProject(projectID int64) ([]*domain.File, error) {
	ctx := context.Background()
	return a.repo.ListByProject(ctx, projectID)
}

func (a *FileAPI) Delete(id int64) (bool, error) {
	ctx := context.Background()
	// ensure exists (optional)
	if _, err := a.repo.Get(ctx, id); err != nil {
		return false, err
	}
	if err := a.repo.Delete(ctx, id); err != nil {
		return false, err
	}
	return true, nil
}
