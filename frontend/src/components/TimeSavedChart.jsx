import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const TimeSavedChart = ({ tempsMoyenMinutes: nbScansNoUser, nbscans_effectues: nbScansUser }) => {
  const total = nbScansNoUser + nbScansUser;
  
  const data = {
    labels: ["Scans sans utilisateur", "Scans avec utilisateur"],
    datasets: [{
      data: [nbScansNoUser, nbScansUser],
      backgroundColor: [
        "hsl(350, 89%, 60%)",  // Couleur pour scans sans user
        "hsl(215, 73.80%, 40.40%)"  // Couleur pour scans avec user
      ],
      borderColor: "hsl(var(--background))",
      borderWidth: 2
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "hsl(0, 0%, 90%)",
          font: { size: 14 }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw;
            const percentage = Math.round((value / total) * 100);
            return ` ${context.label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
    cutout: "70%"
  };

  return (
    <div className="p-8 rounded-xl bg-slate-900/60 border border-white/10 shadow-md hover:bg-slate-900/70 transition-background duration-200">
      <h3 className="text-2xl font-semibold text-rose-400 mb-4 text-center">Répartition des scans</h3>
      <div className="h-64">
        <Doughnut data={data} options={options} />
      </div>
      <div className="mt-4 text-center text-sm text-foreground">
        Total: {total} scans ({nbScansNoUser} sans user, {nbScansUser} avec user)
      </div>
    </div>
  );
};

export default TimeSavedChart;