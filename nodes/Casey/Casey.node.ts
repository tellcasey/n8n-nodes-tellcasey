import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

async function caseyApiRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('caseyApi');

	return (await this.helpers.httpRequest({
		method,
		url: `https://api.tellcasey.com/v1/backend${endpoint}`,
		headers: {
			Authorization: `Bearer ${credentials.apiKey}`,
		},
		body,
		qs,
		json: true,
	})) as IDataObject;
}

export class Casey implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'tellcasey',
		name: 'casey',
		icon: { light: 'file:casey.svg', dark: 'file:casey.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle:
			'={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Interact with the tellcasey API',
		defaults: {
			name: 'tellcasey',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'caseyApi',
				required: true,
			},
		],
		properties: [
			// ------------------------------------------------------------------
			// Resource
			// ------------------------------------------------------------------
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Short Link', value: 'shortLink' },
					{ name: 'Conversation', value: 'conversation' },
					{ name: 'Asset', value: 'asset' },
				],
				default: 'shortLink',
			},

			// ------------------------------------------------------------------
			// Operations
			// ------------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['shortLink'] } },
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a short link with optional conversation context',
						action: 'Create a short link',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['conversation'] } },
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get a conversation by ID',
						action: 'Get a conversation',
					},
					{
						name: 'Get Asset Fields',
						value: 'getAssetFields',
						description:
							'Get assets as flattened fields (field_id + value) for CRM integrations',
						action: 'Get conversation asset fields',
					},
					{
						name: 'Get Assets',
						value: 'getAssets',
						description: 'Get generated assets for a conversation',
						action: 'Get conversation assets',
					},
					{
						name: 'Get Transcript',
						value: 'getTranscript',
						description: 'Get the message transcript for a conversation',
						action: 'Get conversation transcript',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List conversations',
						action: 'List conversations',
					},
				],
				default: 'list',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['asset'] } },
				options: [
					{
						name: 'List',
						value: 'list',
						description: 'List assets for the organization',
						action: 'List assets',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single asset with full content',
						action: 'Get an asset',
					},
				],
				default: 'list',
			},

			// ------------------------------------------------------------------
			// Short Link: Create
			// ------------------------------------------------------------------
			{
				displayName: 'Connection Code',
				name: 'connectionCode',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'my-agent',
				description: 'The connection code (invite code) to link to',
				displayOptions: {
					show: { resource: ['shortLink'], operation: ['create'] },
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['shortLink'], operation: ['create'] },
				},
				options: [
					{
						displayName: 'Slug',
						name: 'slug',
						type: 'string',
						default: '',
						placeholder: 'john-acme-q1',
						description:
							'Custom URL slug. Letters, numbers, and hyphens only. Auto-generated if omitted.',
					},
					{
						displayName: 'Context (JSON)',
						name: 'context',
						type: 'json',
						default: '',
						placeholder:
							'{"participant_profile": {"first_name": "John"}, "custom": {"deal_stage": "discovery"}}',
						description:
							'JSON object with participant_profile and/or custom fields. Merged into conversation context.',
					},
					{
						displayName: 'Query Parameters',
						name: 'queryParams',
						type: 'fixedCollection',
						typeOptions: { multipleValues: true },
						default: {},
						options: [
							{
								displayName: 'Parameter',
								name: 'parameter',
								values: [
									{
										displayName: 'Key',
										name: 'key',
										type: 'string',
										default: '',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
									},
								],
							},
						],
						description: 'Key-value pairs added to the redirect URL',
					},
					{
						displayName: 'Expires At',
						name: 'expiresAt',
						type: 'dateTime',
						default: '',
						description: 'When the short link should expire',
					},
				],
			},

			// ------------------------------------------------------------------
			// Conversation: shared fields
			// ------------------------------------------------------------------
			{
				displayName: 'Conversation ID',
				name: 'conversationId',
				type: 'string',
				required: true,
				default: '',
				description: 'The conversation UUID',
				displayOptions: {
					show: {
						resource: ['conversation'],
						operation: ['get', 'getTranscript', 'getAssets', 'getAssetFields'],
					},
				},
			},

			// ------------------------------------------------------------------
			// Conversation: List filters
			// ------------------------------------------------------------------
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: { resource: ['conversation'], operation: ['list'] },
				},
				options: [
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						default: '',
						options: [
							{ name: 'Abandoned', value: 'abandoned' },
							{ name: 'All', value: '' },
							{ name: 'Archived', value: 'archived' },
							{ name: 'Completed', value: 'completed' },
							{ name: 'In Progress', value: 'in_progress' },
							{ name: 'Pending', value: 'pending' },
						],
					},
					{
						displayName: 'Agent ID',
						name: 'agentId',
						type: 'string',
						default: '',
						description: 'Filter by agent UUID',
					},
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 100 },
						default: 50,
						description: 'Max number of results to return',
					},
					{
						displayName: 'Cursor',
						name: 'after',
						type: 'string',
						default: '',
						description: 'Pagination cursor from a previous response',
					},
				],
			},

			// ------------------------------------------------------------------
			// Conversation: Get Assets options
			// ------------------------------------------------------------------
			{
				displayName: 'Options',
				name: 'assetOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['conversation'],
						operation: ['getAssets', 'getAssetFields'],
					},
				},
				options: [
					{
						displayName: 'Active Only',
						name: 'activeOnly',
						type: 'boolean',
						default: false,
						description:
							'Whether to only return assets assigned to the agent via agent_fields',
					},
				],
			},

			// ------------------------------------------------------------------
			// Asset: shared fields
			// ------------------------------------------------------------------
			{
				displayName: 'Asset ID',
				name: 'assetId',
				type: 'string',
				required: true,
				default: '',
				description: 'The asset UUID',
				displayOptions: {
					show: { resource: ['asset'], operation: ['get'] },
				},
			},

			// ------------------------------------------------------------------
			// Asset: List filters
			// ------------------------------------------------------------------
			{
				displayName: 'Filters',
				name: 'assetFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: { resource: ['asset'], operation: ['list'] },
				},
				options: [
					{
						displayName: 'Conversation ID',
						name: 'conversationId',
						type: 'string',
						default: '',
						description: 'Filter by conversation UUID',
					},
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						default: '',
						options: [
							{ name: 'All', value: '' },
							{ name: 'Approved', value: 'approved' },
							{ name: 'Archived', value: 'archived' },
							{ name: 'Draft', value: 'draft' },
							{ name: 'Error', value: 'error' },
							{ name: 'Generating', value: 'generating' },
							{ name: 'Published', value: 'published' },
						],
					},
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 100 },
						default: 50,
						description: 'Max number of results to return',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: IDataObject;

				// =============================================================
				// Short Link
				// =============================================================
				if (resource === 'shortLink') {
					if (operation === 'create') {
						const connectionCode = this.getNodeParameter(
							'connectionCode',
							i,
						) as string;
						const additionalFields = this.getNodeParameter(
							'additionalFields',
							i,
						) as IDataObject;

						const body: IDataObject = {
							connection_code: connectionCode,
						};

						if (additionalFields.slug) {
							body.slug = additionalFields.slug;
						}

						if (additionalFields.context) {
							body.context =
								typeof additionalFields.context === 'string'
									? JSON.parse(additionalFields.context)
									: additionalFields.context;
						}

						if (additionalFields.queryParams) {
							const params =
								(additionalFields.queryParams as IDataObject)
									?.parameter as IDataObject[];
							if (params?.length) {
								const queryParams: Record<string, string> = {};
								for (const param of params) {
									queryParams[param.key as string] = param.value as string;
								}
								body.query_params = queryParams;
							}
						}

						if (additionalFields.expiresAt) {
							body.expires_at = additionalFields.expiresAt;
						}

						responseData = await caseyApiRequest.call(
							this,
							'POST',
							'/short-links',
							body,
						);

						const executionData =
							this.helpers.constructExecutionMetaData(
								this.helpers.returnJsonArray(
									(responseData.data as IDataObject) ?? responseData,
								),
								{ itemData: { item: i } },
							);
						returnData.push(...executionData);
					}
				}

				// =============================================================
				// Conversation
				// =============================================================
				if (resource === 'conversation') {
					if (operation === 'list') {
						const filters = this.getNodeParameter(
							'filters',
							i,
						) as IDataObject;

						const qs: IDataObject = {};
						if (filters.status) qs.status = filters.status;
						if (filters.agentId) qs.agent_id = filters.agentId;
						if (filters.limit) qs.limit = filters.limit;
						if (filters.after) qs.after = filters.after;

						responseData = await caseyApiRequest.call(
							this,
							'GET',
							'/conversations',
							undefined,
							qs,
						);

						const conversations =
							(responseData.data as IDataObject[]) ?? [];
						const executionData =
							this.helpers.constructExecutionMetaData(
								this.helpers.returnJsonArray(conversations),
								{ itemData: { item: i } },
							);
						returnData.push(...executionData);
					}

					if (operation === 'get') {
						const conversationId = this.getNodeParameter(
							'conversationId',
							i,
						) as string;

						responseData = await caseyApiRequest.call(
							this,
							'GET',
							`/conversations/${conversationId}`,
						);

						const executionData =
							this.helpers.constructExecutionMetaData(
								this.helpers.returnJsonArray(
									(responseData.data as IDataObject) ?? responseData,
								),
								{ itemData: { item: i } },
							);
						returnData.push(...executionData);
					}

					if (operation === 'getTranscript') {
						const conversationId = this.getNodeParameter(
							'conversationId',
							i,
						) as string;

						responseData = await caseyApiRequest.call(
							this,
							'GET',
							`/conversations/${conversationId}/transcripts`,
						);

						const executionData =
							this.helpers.constructExecutionMetaData(
								this.helpers.returnJsonArray(
									(responseData.data as IDataObject) ?? responseData,
								),
								{ itemData: { item: i } },
							);
						returnData.push(...executionData);
					}

					if (operation === 'getAssets' || operation === 'getAssetFields') {
						const conversationId = this.getNodeParameter(
							'conversationId',
							i,
						) as string;
						const options = this.getNodeParameter(
							'assetOptions',
							i,
						) as IDataObject;

						const qs: IDataObject = {};
						if (options.activeOnly) qs.active_only = 'true';

						const path =
							operation === 'getAssetFields'
								? `/conversations/${conversationId}/fields`
								: `/conversations/${conversationId}/assets`;

						responseData = await caseyApiRequest.call(
							this,
							'GET',
							path,
							undefined,
							qs,
						);

						const assets = (responseData.data as IDataObject[]) ?? [];
						const executionData =
							this.helpers.constructExecutionMetaData(
								this.helpers.returnJsonArray(assets),
								{ itemData: { item: i } },
							);
						returnData.push(...executionData);
					}
				}

				// =============================================================
				// Asset
				// =============================================================
				if (resource === 'asset') {
					if (operation === 'list') {
						const filters = this.getNodeParameter(
							'assetFilters',
							i,
						) as IDataObject;

						const qs: IDataObject = {};
						if (filters.conversationId)
							qs.conversation_id = filters.conversationId;
						if (filters.status) qs.status = filters.status;
						if (filters.limit) qs.limit = filters.limit;

						responseData = await caseyApiRequest.call(
							this,
							'GET',
							'/assets',
							undefined,
							qs,
						);

						const assets = (responseData.data as IDataObject[]) ?? [];
						const executionData =
							this.helpers.constructExecutionMetaData(
								this.helpers.returnJsonArray(assets),
								{ itemData: { item: i } },
							);
						returnData.push(...executionData);
					}

					if (operation === 'get') {
						const assetId = this.getNodeParameter(
							'assetId',
							i,
						) as string;

						responseData = await caseyApiRequest.call(
							this,
							'GET',
							`/assets/${assetId}`,
						);

						const executionData =
							this.helpers.constructExecutionMetaData(
								this.helpers.returnJsonArray(
									(responseData.data as IDataObject) ?? responseData,
								),
								{ itemData: { item: i } },
							);
						returnData.push(...executionData);
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					const executionData =
						this.helpers.constructExecutionMetaData(
							this.helpers.returnJsonArray({
								error: error.message,
							}),
							{ itemData: { item: i } },
						);
					returnData.push(...executionData);
					continue;
				}
				throw new NodeOperationError(this.getNode(), error, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}
