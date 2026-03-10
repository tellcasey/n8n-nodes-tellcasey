import type {
	IDataObject,
	IHookFunctions,
	IHttpRequestMethods,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';

async function caseyApiRequest(
	this: IHookFunctions | IWebhookFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('caseyApi');

	return (await this.helpers.httpRequest({
		method,
		url: `https://api.tellcasey.com/v1/backend${endpoint}`,
		headers: {
			Authorization: `Bearer ${credentials.apiKey}`,
		},
		body,
		json: true,
	})) as IDataObject;
}

export class CaseyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'tellcasey Trigger',
		name: 'caseyTrigger',
		icon: { light: 'file:casey.svg', dark: 'file:casey.dark.svg' },
		group: ['trigger'],
		version: [1],
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Triggers when conversation events occur in Casey',
		defaults: {
			name: 'tellcasey Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'caseyApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['conversation.completed'],
				options: [
					{
						name: 'Conversation Started',
						value: 'conversation.started',
						description: 'Triggered when a new conversation begins',
					},
					{
						name: 'Conversation Completed',
						value: 'conversation.completed',
						description: 'Triggered when a conversation finishes successfully',
					},
					{
						name: 'Conversation Abandoned',
						value: 'conversation.abandoned',
						description:
							'Triggered when a conversation is abandoned (timeout, disconnect, etc.)',
					},
				],
				description: 'The conversation events to listen for',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');

				try {
					const response = (await caseyApiRequest.call(
						this,
						'GET',
						'/webhooks',
					)) as IDataObject;

					const endpoints = (response.data as IDataObject[]) ?? [];

					for (const endpoint of endpoints) {
						if (endpoint.url === webhookUrl) {
							webhookData.webhookId = endpoint.id as string;
							return true;
						}
					}
				} catch {
					// If we can't check, assume it doesn't exist
				}

				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events', []) as string[];
				const workflowId = this.getWorkflow().id;

				const response = (await caseyApiRequest.call(this, 'POST', '/webhooks', {
					url: webhookUrl as string,
					description: `n8n workflow #${workflowId}`,
					event_types: events,
				})) as IDataObject;

				const data = response.data as IDataObject;
				if (!data?.id) {
					throw new NodeApiError(this.getNode(), response as JsonObject, {
						message: 'Casey webhook creation did not return an endpoint ID.',
					});
				}

				const webhookData = this.getWorkflowStaticData('node');
				webhookData.webhookId = data.id as string;

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');

				if (webhookData.webhookId) {
					try {
						await caseyApiRequest.call(
							this,
							'DELETE',
							`/webhooks/${webhookData.webhookId}`,
						);
					} catch {
						// Swallow errors — endpoint may already be gone
					}

					delete webhookData.webhookId;
				}

				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData() as IDataObject;
		const events = this.getNodeParameter('events', []) as string[];

		const eventType = bodyData.event_type as string | undefined;

		// Filter: only trigger for selected event types
		if (eventType && events.length > 0 && !events.includes(eventType)) {
			return {};
		}

		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
