package ports

import (
	"context"
	"locail/internal/domain"
)

type ProjectRepository interface {
	Create(ctx context.Context, p *domain.Project) error
	Get(ctx context.Context, id int64) (*domain.Project, error)
	List(ctx context.Context) ([]*domain.Project, error)
	Update(ctx context.Context, p *domain.Project) error
	Delete(ctx context.Context, id int64) error
	AddLocale(ctx context.Context, pl *domain.ProjectLocale) error
	ListLocales(ctx context.Context, projectID int64) ([]*domain.ProjectLocale, error)
}

type FileRepository interface {
	Create(ctx context.Context, f *domain.File) error
	Get(ctx context.Context, id int64) (*domain.File, error)
	ListByProject(ctx context.Context, projectID int64) ([]*domain.File, error)
	Delete(ctx context.Context, id int64) error
}

type UnitRepository interface {
	UpsertBatch(ctx context.Context, units []*domain.Unit) error
	ListByFile(ctx context.Context, fileID int64) ([]*domain.Unit, error)
	Get(ctx context.Context, id int64) (*domain.Unit, error)
}

type TranslationRepository interface {
	Upsert(ctx context.Context, t *domain.Translation) error
	Get(ctx context.Context, unitID int64, locale string) (*domain.Translation, error)
	ListByFileLocale(ctx context.Context, fileID int64, locale string) ([]*domain.Translation, error)
}

type ProviderRepository interface {
	Create(ctx context.Context, p *domain.Provider) error
	Update(ctx context.Context, p *domain.Provider) error
	Get(ctx context.Context, id int64) (*domain.Provider, error)
	List(ctx context.Context) ([]*domain.Provider, error)
	Delete(ctx context.Context, id int64) error
	SaveModelCache(ctx context.Context, providerID int64, names []string) error
	ListModelCache(ctx context.Context, providerID int64) ([]*domain.ProviderModel, error)
}

type JobRepository interface {
	Create(ctx context.Context, j *domain.Job) (int64, error)
	UpdateProgress(ctx context.Context, jobID int64, done, total int, status string) error
	AddItem(ctx context.Context, ji *domain.JobItem) (int64, error)
	UpdateItem(ctx context.Context, itemID int64, status, errMsg string) error
	AddLog(ctx context.Context, jl *domain.JobLog) error
	Get(ctx context.Context, jobID int64) (*domain.Job, error)
	List(ctx context.Context, limit int) ([]*domain.Job, error)
	ListItems(ctx context.Context, jobID int64) ([]*domain.JobItem, error)
	ListLogs(ctx context.Context, jobID int64, limit int) ([]*domain.JobLog, error)
	Delete(ctx context.Context, jobID int64) error
}

type TemplateRepository interface {
	GetEffective(ctx context.Context, scope string, refID *int64, typ, role string) (*domain.Template, error)
	Upsert(ctx context.Context, t *domain.Template) error
}

type CacheRepository interface {
	Get(ctx context.Context, src, srcLang, tgtLang, provider, model string) (*domain.CacheEntry, error)
	Put(ctx context.Context, entry *domain.CacheEntry) error
}

type SettingsRepository interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key, value string) error
}
