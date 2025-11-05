package app

import (
    "context"
    "time"
    "locail/internal/ports"
    "locail/internal/usecase/jobs"
)

type JobsAPI struct { r *jobs.Runner; repo ports.JobRepository }

func NewJobsAPI(r *jobs.Runner, repo ports.JobRepository) *JobsAPI { return &JobsAPI{r: r, repo: repo} }

type StartTranslateFileRequest struct {
    ProjectID  int64    `json:"project_id"`
    ProviderID int64    `json:"provider_id"`
    FileID     int64    `json:"file_id"`
    Locales    []string `json:"locales"`
    Model      string   `json:"model"`
}

type StartJobResponse struct { JobID int64 `json:"job_id"` }

func (a *JobsAPI) StartTranslateFile(req StartTranslateFileRequest) (StartJobResponse, error) {
    ctx := context.Background()
    jid, err := a.r.StartTranslateFile(ctx, req.ProjectID, req.ProviderID, jobs.TranslateFileParams{FileID: req.FileID, TargetLocales: req.Locales, Model: req.Model})
    if err != nil { return StartJobResponse{}, err }
    return StartJobResponse{JobID: jid}, nil
}

type StartTranslateUnitRequest struct {
    ProjectID  int64    `json:"project_id"`
    ProviderID int64    `json:"provider_id"`
    UnitID     int64    `json:"unit_id"`
    Locales    []string `json:"locales"`
    Model      string   `json:"model"`
    Force      bool     `json:"force"`
}

func (a *JobsAPI) StartTranslateUnit(req StartTranslateUnitRequest) (StartJobResponse, error) {
    ctx := context.Background()
    // Always force re-translation from backend to ensure fresh output when requested from UI
    jid, err := a.r.StartTranslateUnit(ctx, req.ProjectID, req.ProviderID, jobs.TranslateUnitParams{UnitID: req.UnitID, Locales: req.Locales, Model: req.Model, Force: true})
    if err != nil { return StartJobResponse{}, err }
    return StartJobResponse{JobID: jid}, nil
}

type StartTranslateUnitsRequest struct {
    ProjectID  int64     `json:"project_id"`
    ProviderID int64     `json:"provider_id"`
    UnitIDs    []int64   `json:"unit_ids"`
    Locales    []string  `json:"locales"`
    Model      string    `json:"model"`
    Force      bool      `json:"force"`
}

func (a *JobsAPI) StartTranslateUnits(req StartTranslateUnitsRequest) (StartJobResponse, error) {
    ctx := context.Background()
    // Always force re-translation from backend to ensure fresh output when requested from UI
    jid, err := a.r.StartTranslateUnits(ctx, req.ProjectID, req.ProviderID, jobs.TranslateUnitsParams{UnitIDs: req.UnitIDs, Locales: req.Locales, Model: req.Model, Force: true})
    if err != nil { return StartJobResponse{}, err }
    return StartJobResponse{JobID: jid}, nil
}

func (a *JobsAPI) Cancel(jobID int64) bool { return a.r.Cancel(jobID) }

// Status endpoints
type JobDTO struct {
    ID int64 `json:"id"`
    Type string `json:"type"`
    Status string `json:"status"`
    Progress int `json:"progress"`
    Total int `json:"total"`
}

func (a *JobsAPI) Get(jobID int64) (*JobDTO, error) {
    ctx := context.Background()
    j, err := a.repo.Get(ctx, jobID)
    if err != nil || j == nil { return nil, err }
    return &JobDTO{ID: j.ID, Type: j.Type, Status: j.Status, Progress: j.Progress, Total: j.Total}, nil
}

func (a *JobsAPI) List(limit int) ([]*JobDTO, error) {
    ctx := context.Background()
    js, err := a.repo.List(ctx, limit)
    if err != nil { return nil, err }
    out := make([]*JobDTO, 0, len(js))
    for _, j := range js { out = append(out, &JobDTO{ID: j.ID, Type: j.Type, Status: j.Status, Progress: j.Progress, Total: j.Total}) }
    return out, nil
}

type JobItemDTO struct { ID int64 `json:"id"`; UnitID *int64 `json:"unit_id"`; Locale *string `json:"locale"`; Status string `json:"status"`; Error string `json:"error"` }
func (a *JobsAPI) Items(jobID int64) ([]*JobItemDTO, error) {
    ctx := context.Background()
    items, err := a.repo.ListItems(ctx, jobID)
    if err != nil { return nil, err }
    out := make([]*JobItemDTO, 0, len(items))
    for _, it := range items { out = append(out, &JobItemDTO{ID: it.ID, UnitID: it.UnitID, Locale: it.Locale, Status: it.Status, Error: it.Error}) }
    return out, nil
}

type JobLogDTO struct { ID int64 `json:"id"`; Time string `json:"time"`; Level string `json:"level"`; Message string `json:"message"` }
func (a *JobsAPI) Logs(jobID int64, limit int) ([]*JobLogDTO, error) {
    ctx := context.Background()
    logs, err := a.repo.ListLogs(ctx, jobID, limit)
    if err != nil { return nil, err }
    out := make([]*JobLogDTO, 0, len(logs))
    for _, l := range logs { out = append(out, &JobLogDTO{ID: l.ID, Time: l.Time.Format(time.RFC3339), Level: l.Level, Message: l.Message}) }
    return out, nil
}

func (a *JobsAPI) Delete(jobID int64) (bool, error) {
    ctx := context.Background()
    return true, a.repo.Delete(ctx, jobID)
}
