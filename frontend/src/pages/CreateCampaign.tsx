import { CloudUpload, ImagePlus } from 'lucide-react';
import { isAddress } from 'ethers';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadCampaignToIpfs, type IpfsUploadProgress } from '../services/ipfs';
import './CreateCampaign.css';

type FormValues = {
  title: string;
  description: string;
  goal: string;
  duration: string;
  beneficiary: string;
};

type FieldName = keyof FormValues | 'image';
type FormErrors = Partial<Record<FieldName, string>>;

const initialValues: FormValues = {
  title: '',
  description: '',
  goal: '',
  duration: '',
  beneficiary: '',
};

const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxImageSize = 5 * 1024 * 1024;

export default function CreateCampaign() {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const imagePreviewUrlRef = useRef('');
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [ipfsProgress, setIpfsProgress] = useState<IpfsUploadProgress | null>(null);
  const [ipfsResult, setIpfsResult] = useState<{ imageCid: string | null; metadataCid: string } | null>(null);
  const [ipfsError, setIpfsError] = useState('');

  const resetIpfsUpload = () => {
    setIpfsProgress(null);
    setIpfsResult(null);
    setIpfsError('');
  };

  useEffect(() => () => {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
    }
  }, []);

  const clearImagePreview = () => {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = '';
    }
    setImagePreview('');
  };

  const updateField = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setShowPreview(false);
    resetIpfsUpload();
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedImage = event.target.files?.[0] ?? null;
    setShowPreview(false);
    resetIpfsUpload();

    if (!selectedImage) {
      clearImagePreview();
      setImage(null);
      setErrors((current) => ({ ...current, image: undefined }));
      return;
    }

    if (!acceptedImageTypes.includes(selectedImage.type)) {
      clearImagePreview();
      setImage(null);
      setErrors((current) => ({ ...current, image: 'createPage.errors.imageType' }));
      return;
    }

    if (selectedImage.size > maxImageSize) {
      clearImagePreview();
      setImage(null);
      setErrors((current) => ({ ...current, image: 'createPage.errors.imageSize' }));
      return;
    }

    clearImagePreview();
    const objectUrl = URL.createObjectURL(selectedImage);
    imagePreviewUrlRef.current = objectUrl;
    setImagePreview(objectUrl);
    setImage(selectedImage);
    setErrors((current) => ({ ...current, image: undefined }));
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!values.title.trim()) nextErrors.title = 'createPage.errors.required';
    if (!values.description.trim()) nextErrors.description = 'createPage.errors.required';
    if (!values.goal.trim()) nextErrors.goal = 'createPage.errors.required';
    else if (!Number.isFinite(Number(values.goal)) || Number(values.goal) <= 0) nextErrors.goal = 'createPage.errors.goal';
    if (!values.duration.trim()) nextErrors.duration = 'createPage.errors.required';
    else if (!Number.isInteger(Number(values.duration)) || Number(values.duration) <= 0) nextErrors.duration = 'createPage.errors.duration';
    if (!values.beneficiary.trim()) nextErrors.beneficiary = 'createPage.errors.required';
    else if (!isAddress(values.beneficiary.trim())) nextErrors.beneficiary = 'createPage.errors.address';
    return nextErrors;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setShowPreview(false);
      window.requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    setShowPreview(true);
  };

  const handleIpfsUpload = async () => {
    if (!showPreview || ipfsProgress?.phase === 'uploadingImage' || ipfsProgress?.phase === 'uploadingMetadata') return;

    setIpfsError('');
    setIpfsResult(null);

    try {
      const result = await uploadCampaignToIpfs(
        { title: values.title, description: values.description, image },
        setIpfsProgress,
      );
      setIpfsResult(result);
    } catch {
      setIpfsProgress(null);
      setIpfsError(t('createPage.ipfs.error'));
    }
  };

  const fieldError = (field: FieldName) => errors[field] ? t(errors[field]) : '';

  return (
    <section className="route-page create-page" aria-labelledby="create-page-title">
      <div className="create-page-heading">
        <p className="route-page-eyebrow">{t('createPage.eyebrow')}</p>
        <h1 id="create-page-title">{t('createPage.title')}</h1>
        <p className="route-page-intro">{t('createPage.intro')}</p>
      </div>

      <div className="create-layout">
        <form ref={formRef} className="campaign-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="campaign-title">{t('createPage.fields.title')}</label>
            <input id="campaign-title" value={values.title} onChange={(event) => updateField('title', event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'campaign-title-error' : undefined} required />
            {errors.title && <p id="campaign-title-error" className="field-error">{fieldError('title')}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="campaign-description">{t('createPage.fields.description')}</label>
            <textarea id="campaign-description" rows={6} value={values.description} onChange={(event) => updateField('description', event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'campaign-description-error' : undefined} required />
            {errors.description && <p id="campaign-description-error" className="field-error">{fieldError('description')}</p>}
          </div>

          <div className="form-field-row">
            <div className="form-field">
              <label htmlFor="campaign-goal">{t('createPage.fields.goal')}</label>
              <input id="campaign-goal" type="number" min="0" step="any" inputMode="decimal" value={values.goal} onChange={(event) => updateField('goal', event.target.value)} aria-invalid={Boolean(errors.goal)} aria-describedby={errors.goal ? 'campaign-goal-error' : undefined} required />
              {errors.goal && <p id="campaign-goal-error" className="field-error">{fieldError('goal')}</p>}
            </div>
            <div className="form-field">
              <label htmlFor="campaign-duration">{t('createPage.fields.duration')}</label>
              <input id="campaign-duration" type="number" min="1" step="1" inputMode="numeric" value={values.duration} onChange={(event) => updateField('duration', event.target.value)} aria-invalid={Boolean(errors.duration)} aria-describedby={errors.duration ? 'campaign-duration-error' : undefined} required />
              {errors.duration && <p id="campaign-duration-error" className="field-error">{fieldError('duration')}</p>}
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="campaign-beneficiary">{t('createPage.fields.beneficiary')}</label>
            <input id="campaign-beneficiary" className="address-input" value={values.beneficiary} onChange={(event) => updateField('beneficiary', event.target.value)} placeholder="0x..." spellCheck={false} aria-invalid={Boolean(errors.beneficiary)} aria-describedby={errors.beneficiary ? 'campaign-beneficiary-error' : 'campaign-beneficiary-hint'} required />
            <p id="campaign-beneficiary-hint" className="field-hint">{t('createPage.fields.beneficiaryHint')}</p>
            {errors.beneficiary && <p id="campaign-beneficiary-error" className="field-error">{fieldError('beneficiary')}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="campaign-image">{t('createPage.fields.image')}</label>
            <label className="image-picker" htmlFor="campaign-image">
              <ImagePlus size={22} strokeWidth={1.7} aria-hidden="true" />
              <span>{image ? image.name : t('createPage.fields.imageAction')}</span>
              <small>{t('createPage.fields.imageHint')}</small>
            </label>
            <input id="campaign-image" className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} aria-invalid={Boolean(errors.image)} aria-describedby={errors.image ? 'campaign-image-error' : undefined} />
            {errors.image && <p id="campaign-image-error" className="field-error">{fieldError('image')}</p>}
          </div>

          <p className="create-safety-note" role="note">{t('createPage.safety')}</p>
          <button className="preview-campaign-button" type="submit">{t('createPage.previewButton')}</button>
        </form>

        <aside className={`campaign-preview ${showPreview ? 'is-ready' : ''}`} aria-live="polite">
          {showPreview ? (
            <>
              {imagePreview && <img src={imagePreview} alt={t('createPage.preview.imageAlt', { title: values.title })} />}
              <span className="preview-demo-badge">DEMO</span>
              <h2>{values.title}</h2>
              <p>{values.description}</p>
              <dl>
                <div><dt>{t('createPage.preview.goal')}</dt><dd>{values.goal} ETH</dd></div>
                <div><dt>{t('createPage.preview.duration')}</dt><dd>{t('createPage.preview.days', { count: Number(values.duration) })}</dd></div>
                <div><dt>{t('createPage.preview.beneficiary')}</dt><dd>{values.beneficiary}</dd></div>
              </dl>
              <p className="preview-disclaimer">{t('createPage.preview.disclaimer')}</p>
              <div className="ipfs-upload-panel">
                <p>{t('createPage.ipfs.separation')}</p>
                <button
                  className="ipfs-upload-button"
                  type="button"
                  onClick={handleIpfsUpload}
                  disabled={ipfsProgress?.phase === 'uploadingImage' || ipfsProgress?.phase === 'uploadingMetadata'}
                >
                  <CloudUpload size={19} aria-hidden="true" />
                  {ipfsProgress && ipfsProgress.phase !== 'complete'
                    ? t(`createPage.ipfs.phases.${ipfsProgress.phase}`)
                    : t('createPage.ipfs.button')}
                </button>
                {ipfsProgress && (
                  <div className="ipfs-progress" aria-live="polite">
                    <progress value={ipfsProgress.percent} max="100" aria-label={t('createPage.ipfs.progress')} />
                    <span>{ipfsProgress.percent}%</span>
                  </div>
                )}
                {ipfsError && <p className="ipfs-error" role="alert">{ipfsError}</p>}
                {ipfsResult && (
                  <div className="ipfs-result" role="status">
                    <strong>{t('createPage.ipfs.success')}</strong>
                    {ipfsResult.imageCid && <p><span>{t('createPage.ipfs.imageCid')}</span><code>{ipfsResult.imageCid}</code></p>}
                    <p><span>{t('createPage.ipfs.metadataCid')}</span><code>{ipfsResult.metadataCid}</code></p>
                    <small>{t('createPage.ipfs.noBlockchain')}</small>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="preview-placeholder">
              <ImagePlus size={30} strokeWidth={1.5} aria-hidden="true" />
              <h2>{t('createPage.preview.emptyTitle')}</h2>
              <p>{t('createPage.preview.emptyText')}</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
