package domain

import "time"

type Provider struct {
	ID         int64     `json:"id"`
	Type       string    `json:"type"` // e.g., ollama, openrouter, openai
	Name       string    `json:"name"`
	BaseURL    string    `json:"base_url"`
	Model      string    `json:"model"`
	APIKey     string    `json:"api_key"`
	OptionsRaw string    `json:"options_json"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type ProviderModel struct {
	ID         int64     `json:"id"`
	ProviderID int64     `json:"provider_id"`
	Name       string    `json:"name"`
	UpdatedAt  time.Time `json:"updated_at"`
}
