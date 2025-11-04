package domain

import "time"

type Job struct {
    ID         int64     `json:"id"`
    Type       string    `json:"type"`   // detect_language, translate_units, translate_file, export
    Status     string    `json:"status"` // queued, running, done, failed, canceled
    ProjectID  *int64    `json:"project_id"`
    ProviderID *int64    `json:"provider_id"`
    ParamsRaw  string    `json:"params_json"`
    Progress   int       `json:"progress"`
    Total      int       `json:"total"`
    CreatedAt  time.Time `json:"created_at"`
    UpdatedAt  time.Time `json:"updated_at"`
}

type JobItem struct {
    ID        int64     `json:"id"`
    JobID     int64     `json:"job_id"`
    UnitID    *int64    `json:"unit_id"`
    Locale    *string   `json:"locale"`
    Status    string    `json:"status"`
    Error     string    `json:"error"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type JobLog struct {
    ID      int64     `json:"id"`
    JobID   int64     `json:"job_id"`
    Time    time.Time `json:"ts"`
    Level   string    `json:"level"`
    Message string    `json:"message"`
}

