import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CaseyApi implements ICredentialType {
	name = 'caseyApi';
	displayName = 'Tellcasey API';
	icon = { light: 'file:../nodes/Casey/casey.svg', dark: 'file:../nodes/Casey/casey.dark.svg' } as const;
	documentationUrl = 'https://developers.tellcasey.com';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'sk_live_...',
			description: 'Your Casey API key. Found in Dashboard → Settings → API Keys.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.tellcasey.com',
			url: '/v1/backend/webhooks',
			method: 'GET',
		},
	};
}
