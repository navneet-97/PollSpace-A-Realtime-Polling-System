// Export as HTML report
export const exportToHTML = (poll) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Poll Results - ${poll.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 40px;
            background-color: #f8fafc;
            color: #1f2937;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
        }
        .title {
            font-size: 2.5rem;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #6b7280;
            font-size: 1.1rem;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
            padding: 20px;
            background-color: #f9fafb;
            border-radius: 8px;
        }
        .info-item {
            text-align: center;
        }
        .info-label {
            font-weight: 600;
            color: #374151;
            margin-bottom: 5px;
        }
        .info-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #3b82f6;
        }
        .results-section {
            margin-bottom: 40px;
        }
        .section-title {
            font-size: 1.5rem;
            font-weight: bold;
            margin-bottom: 20px;
            color: #1f2937;
        }
        .option {
            margin-bottom: 20px;
            padding: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #fafafa;
        }
        .option-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 10px;
        }
        .option-text {
            font-weight: 600;
            color: #1f2937;
        }
        .option-votes {
            color: #6b7280;
            font-weight: 500;
        }
        .progress-bar {
            width: 100%;
            height: 12px;
            background-color: #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #1d4ed8);
            transition: width 0.3s ease;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 0.9rem;
        }
        @media print {
            body { padding: 20px; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">${poll.title}</h1>
            <p class="subtitle">${poll.description || 'Poll Results Report'}</p>
        </div>
        
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Total Votes</div>
                <div class="info-value">${poll.total_votes}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">${poll.status.toUpperCase()}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Options</div>
                <div class="info-value">${poll.options.length}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Created</div>
                <div class="info-value" style="font-size: 1rem;">${new Date(poll.createdAt).toLocaleDateString()}</div>
            </div>
        </div>
        
        <div class="results-section">
            <h2 class="section-title">Voting Results</h2>
            ${poll.options
              .sort((a, b) => b.votes - a.votes)
              .map(option => {
                const percentage = poll.total_votes === 0 ? 0 : Math.round((option.votes / poll.total_votes) * 100);
                return `
                <div class="option">
                    <div class="option-header">
                        <span class="option-text">${option.text}</span>
                        <span class="option-votes">${option.votes} votes (${percentage}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%;"></div>
                    </div>
                </div>`;
              }).join('')}
        </div>
        
        <div class="footer">
            <p>Report generated on ${new Date().toLocaleString()}</p>
            <p>Exported from PollSpace</p>
        </div>
    </div>
</body>
</html>`;

  // Create and download file
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `poll-results-${poll.id}-${new Date().toISOString().slice(0, 10)}.html`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};