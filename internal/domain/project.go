package domain

import "time"

type Project struct {
	ID         int64     `json:"id"`
	Name       string    `json:"name"`
	SourceLang string    `json:"source_lang"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type ProjectLocale struct {
	ID        int64     `json:"id"`
	ProjectID int64     `json:"project_id"`
	Locale    string    `json:"locale"`
	CreatedAt time.Time `json:"created_at"`
}
