package domain

import "time"

type File struct {
    ID        int64     `json:"id"`
    ProjectID int64     `json:"project_id"`
    Path      string    `json:"path"`
    Format    string    `json:"format"`
    Locale    string    `json:"locale"`
    Hash      string    `json:"hash"`
    CreatedAt time.Time `json:"created_at"`
}

type Unit struct {
    ID          int64     `json:"id"`
    FileID      int64     `json:"file_id"`
    Key         string    `json:"key"`
    SourceText  string    `json:"source_text"`
    Context     string    `json:"context"`
    MetadataRaw string    `json:"metadata_json"`
    CreatedAt   time.Time `json:"created_at"`
}

