export namespace app {
	
	export class ExportFileRequest {
	    file_id: number;
	    locale: string;
	    override_format: string;
	    language_name: string;
	
	    static createFrom(source: any = {}) {
	        return new ExportFileRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.file_id = source["file_id"];
	        this.locale = source["locale"];
	        this.override_format = source["override_format"];
	        this.language_name = source["language_name"];
	    }
	}
	export class ExportFileResponse {
	    filename: string;
	    content_b64: string;
	
	    static createFrom(source: any = {}) {
	        return new ExportFileResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.content_b64 = source["content_b64"];
	    }
	}
	export class ImportRequest {
	    project_id: number;
	    filename: string;
	    format: string;
	    locale: string;
	    content_b64: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project_id = source["project_id"];
	        this.filename = source["filename"];
	        this.format = source["format"];
	        this.locale = source["locale"];
	        this.content_b64 = source["content_b64"];
	    }
	}
	export class ImportResponse {
	    file_id: number;
	    units: number;
	
	    static createFrom(source: any = {}) {
	        return new ImportResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.file_id = source["file_id"];
	        this.units = source["units"];
	    }
	}
	export class JobDTO {
	    id: number;
	    type: string;
	    status: string;
	    progress: number;
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new JobDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.status = source["status"];
	        this.progress = source["progress"];
	        this.total = source["total"];
	    }
	}
	export class JobItemDTO {
	    id: number;
	    unit_id?: number;
	    locale?: string;
	    status: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new JobItemDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.unit_id = source["unit_id"];
	        this.locale = source["locale"];
	        this.status = source["status"];
	        this.error = source["error"];
	    }
	}
	export class JobLogDTO {
	    id: number;
	    time: string;
	    level: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new JobLogDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.time = source["time"];
	        this.level = source["level"];
	        this.message = source["message"];
	    }
	}
	export class ModelInfo {
	    Name: string;
	    Description: string;
	    ContextTokens: number;
	
	    static createFrom(source: any = {}) {
	        return new ModelInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Name = source["Name"];
	        this.Description = source["Description"];
	        this.ContextTokens = source["ContextTokens"];
	    }
	}
	export class UnitKV {
	    key: string;
	    source: string;
	    context?: string;
	
	    static createFrom(source: any = {}) {
	        return new UnitKV(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.source = source["source"];
	        this.context = source["context"];
	    }
	}
	export class ParseResponse {
	    locale: string;
	    items: UnitKV[];
	
	    static createFrom(source: any = {}) {
	        return new ParseResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.locale = source["locale"];
	        this.items = this.convertValues(source["items"], UnitKV);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProviderTestResult {
	    ok: boolean;
	    translation?: string;
	    raw?: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ProviderTestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.translation = source["translation"];
	        this.raw = source["raw"];
	        this.error = source["error"];
	    }
	}
	export class StartJobResponse {
	    job_id: number;
	
	    static createFrom(source: any = {}) {
	        return new StartJobResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.job_id = source["job_id"];
	    }
	}
	export class StartTranslateFileRequest {
	    project_id: number;
	    provider_id: number;
	    file_id: number;
	    locales: string[];
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new StartTranslateFileRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project_id = source["project_id"];
	        this.provider_id = source["provider_id"];
	        this.file_id = source["file_id"];
	        this.locales = source["locales"];
	        this.model = source["model"];
	    }
	}
	export class StartTranslateUnitRequest {
	    project_id: number;
	    provider_id: number;
	    unit_id: number;
	    locales: string[];
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new StartTranslateUnitRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project_id = source["project_id"];
	        this.provider_id = source["provider_id"];
	        this.unit_id = source["unit_id"];
	        this.locales = source["locales"];
	        this.model = source["model"];
	    }
	}
	export class StartTranslateUnitsRequest {
	    project_id: number;
	    provider_id: number;
	    unit_ids: number[];
	    locales: string[];
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new StartTranslateUnitsRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project_id = source["project_id"];
	        this.provider_id = source["provider_id"];
	        this.unit_ids = source["unit_ids"];
	        this.locales = source["locales"];
	        this.model = source["model"];
	    }
	}
	
	export class UnitText {
	    unit_id: number;
	    key: string;
	    source: string;
	    translation: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new UnitText(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.unit_id = source["unit_id"];
	        this.key = source["key"];
	        this.source = source["source"];
	        this.translation = source["translation"];
	        this.status = source["status"];
	    }
	}
	export class UpsertItem {
	    key: string;
	    source: string;
	    context: string;
	    metadata_json: string;
	
	    static createFrom(source: any = {}) {
	        return new UpsertItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.source = source["source"];
	        this.context = source["context"];
	        this.metadata_json = source["metadata_json"];
	    }
	}
	export class UpsertTranslationRequest {
	    unit_id: number;
	    locale: string;
	    text: string;
	    status: string;
	    provider_id?: number;
	
	    static createFrom(source: any = {}) {
	        return new UpsertTranslationRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.unit_id = source["unit_id"];
	        this.locale = source["locale"];
	        this.text = source["text"];
	        this.status = source["status"];
	        this.provider_id = source["provider_id"];
	    }
	}

}

export namespace domain {
	
	export class File {
	    id: number;
	    project_id: number;
	    path: string;
	    format: string;
	    locale: string;
	    hash: string;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new File(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.path = source["path"];
	        this.format = source["format"];
	        this.locale = source["locale"];
	        this.hash = source["hash"];
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Project {
	    id: number;
	    name: string;
	    source_lang: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.source_lang = source["source_lang"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProjectLocale {
	    id: number;
	    project_id: number;
	    locale: string;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new ProjectLocale(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.locale = source["locale"];
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Provider {
	    id: number;
	    type: string;
	    name: string;
	    base_url: string;
	    model: string;
	    api_key: string;
	    options_json: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Provider(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.name = source["name"];
	        this.base_url = source["base_url"];
	        this.model = source["model"];
	        this.api_key = source["api_key"];
	        this.options_json = source["options_json"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Unit {
	    id: number;
	    file_id: number;
	    key: string;
	    source_text: string;
	    context: string;
	    metadata_json: string;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Unit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.file_id = source["file_id"];
	        this.key = source["key"];
	        this.source_text = source["source_text"];
	        this.context = source["context"];
	        this.metadata_json = source["metadata_json"];
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace jobs {
	
	export class Runner {
	
	
	    static createFrom(source: any = {}) {
	        return new Runner(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

