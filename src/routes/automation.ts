import type { WalletAuthInput } from "../lib/server/wallet-auth";
import {
  automationErrorResponse,
  createAutomationTask,
  createTelegramLinkCode,
  deleteAutomationTask,
  pollTelegramLink,
  processTelegramWebhookUpdate,
  readAutomationDashboard,
  readInAppAutomationNotifications,
  readAutomationRuns,
  readAutomationSettings,
  markAllInAppAutomationNotificationsRead,
  markInAppAutomationNotificationRead,
  requestNotificationEmailLink,
  runAutomationEvent,
  runAutomationTask,
  runDueAutomationTasks,
  runAutomationWebhook,
  setAllAutomationStatus,
  updateAutomationSettings,
  updateAutomationTask,
  verifyNotificationEmailLink,
} from "../lib/automation/service";
import type {
  AutomationSettingsInput,
  AutomationTaskInput,
  AutomationTriggeredBy,
} from "../lib/automation/types";

type AutomationBody = {
  action?: unknown;
  code?: unknown;
  email?: unknown;
  eventName?: unknown;
  limit?: unknown;
  notificationId?: unknown;
  payload?: unknown;
  settings?: AutomationSettingsInput;
  task?: AutomationTaskInput;
  taskId?: unknown;
  triggeredBy?: unknown;
  wallet?: WalletAuthInput;
};

export async function handleAutomationTasks(request: Request) {
  const body = await readAutomationBody(request);

  if ("response" in body) {
    return body.response;
  }

  const auth = { request, wallet: body.wallet ?? {} };

  try {
    if (!body.action || body.action === "list") {
      return Response.json(await readAutomationDashboard(auth));
    }

    if (body.action === "create") {
      return Response.json({
        configured: true,
        task: await createAutomationTask(auth, body.task ?? {}),
      });
    }

    if (body.action === "update") {
      return Response.json({
        configured: true,
        task: await updateAutomationTask(
          auth,
          body.taskId,
          body.task ?? {}
        ),
      });
    }

    if (body.action === "pause") {
      return Response.json({
        configured: true,
        task: await updateAutomationTask(auth, body.taskId, {
          status: "paused",
        }),
      });
    }

    if (body.action === "resume") {
      return Response.json({
        configured: true,
        task: await updateAutomationTask(auth, body.taskId, {
          status: "active",
        }),
      });
    }

    if (body.action === "delete") {
      return Response.json({
        configured: true,
        ...(await deleteAutomationTask(auth, body.taskId)),
      });
    }

    if (body.action === "pause-all") {
      return Response.json({
        configured: true,
        tasks: await setAllAutomationStatus(auth, "paused"),
      });
    }

    if (body.action === "resume-all") {
      return Response.json({
        configured: true,
        tasks: await setAllAutomationStatus(auth, "active"),
      });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return automationErrorResponse(error);
  }
}

export async function handleAutomationRuns(request: Request) {
  const body = await readAutomationBody(request);

  if ("response" in body) {
    return body.response;
  }

  const auth = { request, wallet: body.wallet ?? {} };

  try {
    if (!body.action || body.action === "list") {
      return Response.json({
        configured: true,
        runs: await readAutomationRuns(auth, body.taskId),
      });
    }

    if (body.action === "run") {
      return Response.json({
        configured: true,
        run: await runAutomationTask(
          auth,
          body.taskId,
          readTriggeredBy(body.triggeredBy)
        ),
      });
    }

    if (body.action === "tick") {
      return Response.json({
        configured: true,
        runs: await runDueAutomationTasks(auth, body.limit),
      });
    }

    if (body.action === "event") {
      return Response.json({
        configured: true,
        runs: await runAutomationEvent(
          auth,
          body.eventName,
          body.payload,
          body.limit
        ),
      });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return automationErrorResponse(error);
  }
}

export async function handleAutomationSettings(request: Request) {
  const body = await readAutomationBody(request);

  if ("response" in body) {
    return body.response;
  }

  const auth = { request, wallet: body.wallet ?? {} };

  try {
    if (!body.action || body.action === "get") {
      return Response.json({
        configured: true,
        settings: await readAutomationSettings(auth),
      });
    }

    if (body.action === "update") {
      return Response.json({
        configured: true,
        settings: await updateAutomationSettings(
          auth,
          body.settings ?? {}
        ),
      });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return automationErrorResponse(error);
  }
}

export async function handleAutomationNotifications(request: Request) {
  const body = await readAutomationBody(request);

  if ("response" in body) {
    return body.response;
  }

  const auth = { request, wallet: body.wallet ?? {} };

  try {
    if (body.action === "request-email-link") {
      return Response.json({
        configured: true,
        link: await requestNotificationEmailLink(auth, body.email),
      });
    }

    if (body.action === "verify-email-link") {
      return Response.json({
        configured: true,
        settings: await verifyNotificationEmailLink(
          auth,
          body.code
        ),
      });
    }

    if (body.action === "create-telegram-link") {
      return Response.json({
        configured: true,
        link: await createTelegramLinkCode(auth),
      });
    }

    if (body.action === "poll-telegram-link") {
      return Response.json({
        configured: true,
        ...(await pollTelegramLink(auth)),
      });
    }

    if (body.action === "list-in-app") {
      return Response.json({
        configured: true,
        notifications: await readInAppAutomationNotifications(auth, body.limit),
      });
    }

    if (body.action === "mark-in-app-read") {
      return Response.json({
        configured: true,
        notification: await markInAppAutomationNotificationRead(
          auth,
          body.notificationId
        ),
      });
    }

    if (body.action === "mark-all-in-app-read") {
      return Response.json({
        configured: true,
        ...(await markAllInAppAutomationNotificationsRead(auth)),
      });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return automationErrorResponse(error);
  }
}

export async function handleAutomationWebhook(request: Request, slug: string) {
  const payload = await readOptionalJsonBody(request);

  if ("response" in payload) {
    return payload.response;
  }

  try {
    return Response.json({
      configured: true,
      run: await runAutomationWebhook(slug, payload.value),
    });
  } catch (error) {
    return automationErrorResponse(error);
  }
}

export async function handleAutomationTelegramWebhook(request: Request) {
  let update: unknown;

  try {
    update = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  try {
    return Response.json({
      configured: true,
      ...(await processTelegramWebhookUpdate(update)),
    });
  } catch (error) {
    return automationErrorResponse(error);
  }
}

async function readAutomationBody(
  request: Request
): Promise<AutomationBody | { response: Response }> {
  try {
    return (await request.json()) as AutomationBody;
  } catch {
    return {
      response: Response.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      ),
    };
  }
}

async function readOptionalJsonBody(
  request: Request
): Promise<{ value: unknown } | { response: Response }> {
  const text = await request.text();

  if (!text.trim()) {
    return { value: undefined };
  }

  try {
    return { value: JSON.parse(text) };
  } catch {
    return {
      response: Response.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      ),
    };
  }
}

function readTriggeredBy(value: unknown): AutomationTriggeredBy {
  if (
    value === "schedule" ||
    value === "event" ||
    value === "webhook" ||
    value === "manual" ||
    value === "system"
  ) {
    return value;
  }

  return "manual";
}
