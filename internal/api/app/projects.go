package app

import (
    "context"
    "locail/internal/domain"
    "locail/internal/ports"
)

type ProjectAPI struct {
    repo ports.ProjectRepository
}

func NewProjectAPI(repo ports.ProjectRepository) *ProjectAPI { return &ProjectAPI{repo: repo} }

func (a *ProjectAPI) Create(name, sourceLang string) (*domain.Project, error) {
    ctx := context.Background()
    p := &domain.Project{Name: name, SourceLang: sourceLang}
    if err := a.repo.Create(ctx, p); err != nil { return nil, err }
    return p, nil
}

func (a *ProjectAPI) List() ([]*domain.Project, error) {
    ctx := context.Background()
    return a.repo.List(ctx)
}

func (a *ProjectAPI) Update(id int64, name, sourceLang string) (*domain.Project, error) {
    ctx := context.Background()
    p, err := a.repo.Get(ctx, id)
    if err != nil { return nil, err }
    p.Name = name
    p.SourceLang = sourceLang
    if err := a.repo.Update(ctx, p); err != nil { return nil, err }
    return p, nil
}

func (a *ProjectAPI) Delete(id int64) (bool, error) {
    ctx := context.Background()
    return true, a.repo.Delete(ctx, id)
}

func (a *ProjectAPI) AddLocale(projectID int64, locale string) (*domain.ProjectLocale, error) {
    ctx := context.Background()
    pl := &domain.ProjectLocale{ProjectID: projectID, Locale: locale}
    if err := a.repo.AddLocale(ctx, pl); err != nil { return nil, err }
    return pl, nil
}

func (a *ProjectAPI) ListLocales(projectID int64) ([]*domain.ProjectLocale, error) {
    ctx := context.Background()
    return a.repo.ListLocales(ctx, projectID)
}
