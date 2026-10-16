
import { useEffect, useState } from 'react';
import { FormBuilder } from '@msflib/react-components';
import type { FormElement } from '@msflib/react-components';

interface MSFLibThresholdProps {
  currentLimit: number;
  onApply: (watts: number) => Promise<void>;
}

const elements: FormElement[] = [
  {
    id: 'gridnova-threshold-input',
    name: 'threshold',
    dType: 'number',
    label: 'Desired Power Threshold (W)',
    placeholder: 'Enter 1 to 999',
    mData: {
      required: true,
      inputProps: {
        type: 'number',
        min: 1,
        max: 999,
        step: 1,
      },
    },
  },
];

export default function MSFLibThreshold({
  currentLimit,
  onApply,
}: MSFLibThresholdProps) {
  const [formData, setFormData] = useState({
    threshold: String(currentLimit || 70),
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingLimit, setPendingLimit] = useState<number | null>(
    null
  );

  useEffect(() => {
    if (!loading && pendingLimit === null) {
      setFormData({
        threshold: String(currentLimit || 70),
      });
    }
  }, [currentLimit, loading, pendingLimit]);

  useEffect(() => {
    if (
      pendingLimit !== null &&
      currentLimit === pendingLimit
    ) {
      setMessage(
        `Confirmed: ESP32 threshold is now ${currentLimit} W.`
      );
      setPendingLimit(null);
    }
  }, [currentLimit, pendingLimit]);

  async function handleSubmit(data: any) {
    if (loading) return;

    const raw = String(data?.threshold ?? '').trim();
    const watts = Number(raw);

    if (
      !raw ||
      !Number.isInteger(watts) ||
      watts < 1 ||
      watts > 999
    ) {
      setMessage(
        'Please enter a whole number between 1 and 999 W.'
      );
      return;
    }

    if (watts === currentLimit) {
      setMessage(
        `The ESP32 threshold is already ${watts} W.`
      );
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await onApply(watts);

      setPendingLimit(watts);
      setMessage(
        `Command for ${watts} W submitted. ` +
        'Waiting for ESP32 telemetry confirmation.'
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to submit threshold command.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gridnova-threshold-form">
      <h3>MSFLib Smart Threshold Configuration</h3>

      <p>
        Current ESP32 threshold:{' '}
        <strong>{currentLimit} W</strong>
      </p>

      <p className="foot">
        Configure the simulated load-management threshold
        using the MSFLib FormBuilder component.
      </p>

      <FormBuilder
        elements={elements}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        loadingState={loading}
      />

      <button
        type="button"
        className="primary"
        disabled={loading}
        onClick={() => handleSubmit(formData)}
        style={{
          marginTop: 18,
          marginBottom: 14,
          padding: '12px 22px',
          borderRadius: 9,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading
          ? 'Applying Threshold...'
          : 'Apply Power Threshold'}
      </button>

      {message && (
        <p role="status" className="foot">
          {message}
        </p>
      )}

      <p className="foot">
        The command is queued before the ESP32 applies it.
        Confirm the new threshold from device telemetry.
      </p>

      <small className="foot">
        This threshold controls simulated load-management
        logic. It is not a certified electrical protection
        setting.
      </small>
    </div>
  );
}
