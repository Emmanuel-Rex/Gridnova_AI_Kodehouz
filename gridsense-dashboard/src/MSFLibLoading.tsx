
import { AppSkeleton } from '@msflib/react-components';

export default function MSFLibLoading() {
  return (
    <div
      className="panel"
      role="status"
      aria-label="Loading Gridnova AI telemetry"
    >
      <AppSkeleton className="gridnova-loading">
        <div style={{ padding: 24 }}>
          <AppSkeleton.Text
            lines={1}
            height={42}
            animation="wave"
          />

          <AppSkeleton.Text
            lines={2}
            height={26}
            animation="wave"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 20,
              marginTop: 24,
            }}
          >
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="controlCard"
                style={{ padding: 20 }}
              >
                <AppSkeleton.Text
                  lines={1}
                  height={28}
                  animation="wave"
                />

                <AppSkeleton.Text
                  lines={2}
                  height={40}
                  animation="wave"
                />

                <AppSkeleton.Button
                  width={140}
                  height={42}
                  animation="wave"
                />
              </div>
            ))}
          </div>
        </div>
      </AppSkeleton>

      <p
        className="foot"
        style={{ textAlign: 'center', marginTop: 16 }}
      >
        Connecting to Gridnova AI backend and loading
        ESP32 telemetry...
      </p>
    </div>
  );
}
