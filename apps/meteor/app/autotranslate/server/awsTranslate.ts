import type { IMessage, IProviderMetadata, ISupportedLanguage, ITranslationResult, MessageAttachment } from '@rocket.chat/core-typings';
import AWS, { Translate } from 'aws-sdk';
import _ from 'underscore';

import { AutoTranslate, TranslationProviderRegistry } from './autotranslate';
import { i18n } from '../../../server/lib/i18n';
import { SystemLogger } from '../../../server/lib/logger/system';
import { settings } from '../../settings/server';

/**
 * Represents aws translate class
 * @class
 * @augments AutoTranslate
 */

const apiVersion = '2017-07-01';

class AwsAutoTranslate extends AutoTranslate {
	client: Translate;

	accessKeyId: string;

	secretAccessKey: string;

	region: string;

	/**
	 * setup api reference to AWS translate to be used as message translation provider.
	 * @constructor
	 */
	constructor() {
		super();
		this.name = 'aws-translate';

		settings.watch<string>('AutoTranslate_AWSAccessKeyId', (value) => {
			this.accessKeyId = value;

			if (this.accessKeyId && this.secretAccessKey) {
				AWS.config.update({
					credentials: new AWS.Credentials(this.accessKeyId, this.secretAccessKey),
				});
				this.client = new Translate({ apiVersion });
			}
		});

		settings.watch<string>('AutoTranslate_AWSSecretAccessKey', (value) => {
			this.secretAccessKey = value;

			if (this.accessKeyId && this.secretAccessKey) {
				AWS.config.update({
					credentials: new AWS.Credentials(this.accessKeyId, this.secretAccessKey),
				});
				this.client = new Translate({ apiVersion });
			}
		});

		settings.watch<string>('AutoTranslate_AWSRegion', (value) => {
			this.region = value;
			AWS.config.update({ region: this.region });
			this.client = new Translate({ apiVersion });
		});
	}

	/**
	 * Returns metadata information about the service provider
	 * @private implements super abstract method.
	 * @returns {object}
	 */
	_getProviderMetadata(): IProviderMetadata {
		return {
			name: this.name,
			displayName: i18n.t('AutoTranslate_AWS'),
			settings: this._getSettings(),
		};
	}

	/**
	 * Returns necessary settings information about the translation service provider.
	 * @private implements super abstract method.
	 * @returns {object}
	 */
	_getSettings(): IProviderMetadata['settings'] {
		return {
			apiKey: '', // Not used with AWS SDK
			apiEndPointUrl: '', // Not used with AWS SDK
		};
	}

	/**
	 * Returns supported languages for translation by the active service provider.
	 * AWS Translate api provides the list of supported languages.
	 * @private implements super abstract method.
	 * @param {string} target : user language setting or 'en'
	 * @returns {object} code : value pair
	 */
	async getSupportedLanguages(target: string): Promise<ISupportedLanguage[]> {
		await new Promise<void>((resolve, reject) => AWS.config.getCredentials((err) => (err ? reject(err) : resolve())));

		const creds = AWS.config.credentials;

		if (!creds?.accessKeyId || !creds?.secretAccessKey || !AWS.config.region) {
			SystemLogger.error({ msg: 'AWS credentials or region not set.' });

			return [];
		}

		if (this.supportedLanguages[target]) {
			return this.supportedLanguages[target];
		}

		await this.client
			.listLanguages({
				DisplayLanguageCode: target,
				MaxResults: 500,
			})
			.promise()
			.then((r) => {
				if (r?.Languages) {
					this.supportedLanguages[target] = r.Languages.map((language: { LanguageCode: string; LanguageName: string }) => ({
						language: language.LanguageCode,
						name: language.LanguageName,
					}));
				}
			})
			.catch((err) => {
				SystemLogger.error({ msg: 'Error getting supported languages.', err });

				return [];
			});

		return this.supportedLanguages[target || 'en'];
	}

	/**
	 * Send Request to the service provider.
	 * Returns translated message for each target language in target languages.
	 * @private
	 * @param {object} message
	 * @param {object} targetLanguages
	 * @returns {object} translations: Translated messages for each language
	 */
	async _translateMessage(message: IMessage, targetLanguages: string[]): Promise<ITranslationResult> {
		const translations: { [k: string]: string } = {};
		const supportedLanguages = await this.getSupportedLanguages('en');

		for await (let language of targetLanguages) {
			if (language.indexOf('-') !== -1 && !_.findWhere(supportedLanguages, { language })) {
				language = language.substr(0, 2);
			}

			await this.client
				.translateText({
					Text: message.msg,
					SourceLanguageCode: 'auto', // let AWS detect the source
					TargetLanguageCode: language,
				})
				.promise()
				.then((r) => {
					const text = r.TranslatedText || '';

					translations[language] = this.deTokenize(Object.assign({}, message, { msg: text }));
				})
				.catch((err) => {
					SystemLogger.error({ msg: 'Error translating message.', err });
				});
		}

		return translations;
	}

	/**
	 * Returns translated message attachment description in target languages.
	 * @private
	 * @param {object} attachment
	 * @param {object} targetLanguages
	 * @returns {object} translated attachment descriptions for each target language
	 */
	async _translateAttachmentDescriptions(attachment: MessageAttachment, targetLanguages: string[]): Promise<ITranslationResult> {
		console.debug({ msg: 'Function _translateAttachmentDescriptions not implemented.', attachment, targetLanguages });

		return {};
	}
}

// Register AWS translation provider.
TranslationProviderRegistry.registerProvider(new AwsAutoTranslate());
