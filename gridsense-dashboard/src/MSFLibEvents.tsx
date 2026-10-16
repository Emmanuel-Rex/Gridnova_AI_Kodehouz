
import { TableWidget } from '@msflib/react-components';

export interface GridnovaEvent {
  event?: string;
  time?: number;
  device?: string;
  severity?: string;
}

interface Props {
  events: GridnovaEvent[];
}

function describeEvent(event?: string) {
  switch (event) {
    case 'gridsense.overload_detected':
      return 'Estimated Demand Limit Exceeded';
    case 'gridsense.overload_cleared':
      return 'Demand Limit Condition Cleared';
    case 'gridsense.load_shedding_reported':
      return 'Automatic Load Shedding';
    case 'gridsense.thermal_trip':
      return 'Temperature Protection Trip';
    case 'gridsense.thermal_trip_cleared':
      return 'Temperature Protection Recovered';
    default:
      return event?.replace(/^gridsense\./, '').replace(/_/g, ' ') || 'System Event';
  }
}

function classifySeverity(event?: string) {
  switch (event) {
    case 'gridsense.thermal_trip':
      return 'Critical';
    case 'gridsense.overload_detected':
    case 'gridsense.load_shedding_reported':
      return 'Warning';
    case 'gridsense.overload_cleared':
    case 'gridsense.thermal_trip_cleared':
      return 'Resolved';
    default:
      return 'Info';
  }
}

export default function MSFLibEvents({ events }: Props) {
  const rows = [...events]
    .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
    .map((item, index) => ({
      id: index + 1,
      event: describeEvent(item.event),
      timestamp:
        typeof item.time === 'number'
          ? new Date(item.time * 1000).toLocaleString()
          : 'N/A',
      severity: classifySeverity(item.event),
      device: item.device ?? 'gridnova-esp32',
    }));

  const columns = [
    { field: 'event', headerName: 'Event Type', flex: 2, minWidth: 230 },
    { field: 'timestamp', headerName: 'Timestamp', flex: 1.4, minWidth: 175 },
    { field: 'severity', headerName: 'Severity', flex: 1, minWidth: 110 },
    { field: 'device', headerName: 'Device', flex: 1.2, minWidth: 150 },
  ];

  return (
    <div className="gridnova-msflib-events">
      <TableWidget
        rows={rows}
        columns={columns}
        pageSize={10}
        pageSizeOptions={[5, 10, 20]}
        tableTitle="Gridnova AI — Operational Events"
        enableSearch
        autoHeight
      />
    </div>
  );
}
