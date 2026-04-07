import type { SweetbookWebhookEvent } from "@/lib/trip-domain";

type SweetbookEnvironment = "sandbox" | "live";

type JsonRecord = Record<string, unknown>;

type SweetbookRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  searchParams?: Record<string, string | number | undefined>;
  json?: JsonRecord;
  formData?: FormData;
  idempotencyKey?: string;
};

type WebhookConfigInput = {
  webhookUrl: string;
  events?: SweetbookWebhookEvent[] | null;
  description?: string;
};

type DeliveryFilter = {
  status?: "PENDING" | "SUCCESS" | "FAILED" | "EXHAUSTED";
  eventType?: SweetbookWebhookEvent;
  limit?: number;
};

type CreateBookInput = {
  bookSpecUid: string;
  title?: string;
  specProfileUid?: string;
  externalRef?: string;
};

function getEnvironment(): SweetbookEnvironment {
  return process.env.SWEETBOOK_ENV === "live" ? "live" : "sandbox";
}

function getBaseUrl() {
  return getEnvironment() === "live"
    ? "https://api.sweetbook.com/v1"
    : "https://api-sandbox.sweetbook.com/v1";
}

function getApiKey() {
  const apiKey = process.env.SWEETBOOK_API_KEY;

  if (!apiKey) {
    throw new Error("SWEETBOOK_API_KEY is missing.");
  }

  return apiKey;
}

async function parseSweetbookResponse(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Sweetbook request failed with ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return data;
}

async function sweetbookRequest<T>({
  path,
  options,
}: {
  path: string;
  options?: SweetbookRequestOptions;
}): Promise<T> {
  const url = new URL(`${getBaseUrl()}${path}`);

  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers = new Headers({
    Authorization: `Bearer ${getApiKey()}`,
    "Idempotency-Key": options?.idempotencyKey ?? crypto.randomUUID(),
  });

  let body: string | FormData | undefined;
  if (options?.json) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  } else if (options?.formData) {
    body = options.formData;
  }

  const response = await fetch(url, {
    method: options?.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });

  return parseSweetbookResponse(response) as Promise<T>;
}

export const sweetbookClient = {
  listBookSpecs() {
    return sweetbookRequest({
      path: "/book-specs",
    });
  },

  createBook(input: CreateBookInput) {
    return sweetbookRequest({
      path: "/books",
      options: {
        method: "POST",
        json: {
          bookSpecUid: input.bookSpecUid,
          ...(input.title ? { title: input.title } : {}),
          ...(input.specProfileUid ? { specProfileUid: input.specProfileUid } : {}),
          ...(input.externalRef ? { externalRef: input.externalRef } : {}),
        },
      },
    });
  },

  uploadPhoto(bookUid: string, file: File, preserveExif = true) {
    const formData = new FormData();
    formData.append("file", file);
    if (preserveExif) {
      formData.append("preserveExif", "true");
    }

    return sweetbookRequest({
      path: `/books/${bookUid}/photos`,
      options: {
        method: "POST",
        formData,
      },
    });
  },

  createCover(
    bookUid: string,
    templateUid: string,
    parameters: JsonRecord,
    files: File[],
    fileFieldName = "coverPhoto",
  ) {
    const formData = new FormData();
    formData.append("templateUid", templateUid);
    formData.append("parameters", JSON.stringify(parameters));
    files.forEach((file) => formData.append(fileFieldName, file));

    return sweetbookRequest({
      path: `/books/${bookUid}/cover`,
      options: {
        method: "POST",
        formData,
      },
    });
  },

  insertContent(
    bookUid: string,
    templateUid: string,
    parameters: JsonRecord,
    files: File[] = [],
    breakBefore?: "none" | "column" | "page",
    fileFieldName = "photos",
  ) {
    const formData = new FormData();
    formData.append("templateUid", templateUid);
    formData.append("parameters", JSON.stringify(parameters));
    files.forEach((file) => formData.append(fileFieldName, file));

    return sweetbookRequest({
      path: `/books/${bookUid}/contents`,
      options: {
        method: "POST",
        searchParams: {
          breakBefore,
        },
        formData,
      },
    });
  },

  finalizeBook(bookUid: string) {
    return sweetbookRequest({
      path: `/books/${bookUid}/finalization`,
      options: {
        method: "POST",
        json: {},
      },
    });
  },

  createOrder(payload: JsonRecord, idempotencyKey?: string) {
    return sweetbookRequest({
      path: "/orders",
      options: {
        method: "POST",
        json: payload,
        idempotencyKey,
      },
    });
  },

  putWebhookConfig(payload: WebhookConfigInput) {
    return sweetbookRequest({
      path: "/webhooks/config",
      options: {
        method: "PUT",
        json: {
          webhookUrl: payload.webhookUrl,
          events: payload.events ?? null,
          ...(payload.description ? { description: payload.description } : {}),
        },
      },
    });
  },

  getWebhookConfig() {
    return sweetbookRequest({
      path: "/webhooks/config",
    });
  },

  deleteWebhookConfig() {
    return sweetbookRequest({
      path: "/webhooks/config",
      options: {
        method: "DELETE",
      },
    });
  },

  sendWebhookTest(eventType: SweetbookWebhookEvent) {
    return sweetbookRequest({
      path: "/webhooks/test",
      options: {
        method: "POST",
        json: { eventType },
      },
    });
  },

  listWebhookDeliveries(filters: DeliveryFilter) {
    return sweetbookRequest({
      path: "/webhooks/deliveries",
      options: {
        searchParams: {
          status: filters.status,
          eventType: filters.eventType,
          limit: filters.limit,
        },
      },
    });
  },
};
