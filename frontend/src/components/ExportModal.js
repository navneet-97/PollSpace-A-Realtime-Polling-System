import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Globe,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { exportToHTML } from '../utils/exportUtils';

const ExportModal = ({ isOpen, onClose, poll }) => {
  const [selectedFormat, setSelectedFormat] = useState('html');
  const [isExporting, setIsExporting] = useState(false);

  const exportFormats = [
    {
      id: 'html',
      name: 'HTML Report',
      description: 'Beautiful, printable web report with charts',
      icon: Globe,
      extension: '.html',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    }
  ];

  const handleExport = async () => {
    if (!poll) return;
    
    setIsExporting(true);
    
    try {
      switch (selectedFormat) {
        case 'html':
          exportToHTML(poll);
          break;
        default:
          throw new Error('Invalid export format');
      }
      
      const formatName = exportFormats.find(f => f.id === selectedFormat)?.name;
      toast.success(`Poll results exported as ${formatName}!`);
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export poll results. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedFormatData = exportFormats.find(f => f.id === selectedFormat);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Export Poll Results</h2>
            <p className="text-sm text-gray-600 mt-1">Export as HTML report</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Poll Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-1">{poll?.title}</h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>{poll?.total_votes} votes</span>
            <span>•</span>
            <span>{poll?.options?.length} options</span>
            <span>•</span>
            <span className="capitalize">{poll?.status}</span>
          </div>
        </div>

        {/* Format Selection */}
        <div className="p-6">
          <h4 className="font-medium text-gray-900 mb-4">Export Format</h4>
          <div className="grid grid-cols-1 gap-4">
            {exportFormats.map((format) => {
              const Icon = format.icon;
              const isSelected = selectedFormat === format.id;
              
              return (
                <div
                  key={format.id}
                  className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? `${format.borderColor} ${format.bgColor}`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle className={`w-5 h-5 ${format.color}`} />
                    </div>
                  )}
                  
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${isSelected ? format.bgColor : 'bg-gray-100'}`}>
                      <Icon className={`w-5 h-5 ${isSelected ? format.color : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h5 className="font-medium text-gray-900">{format.name}</h5>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {format.extension}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{format.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        {selectedFormatData && (
          <div className="px-6 pb-6">
            <div className={`p-4 rounded-lg ${selectedFormatData.bgColor} border ${selectedFormatData.borderColor}`}>
              <div className="flex items-center space-x-2 mb-2">
                <selectedFormatData.icon className={`w-4 h-4 ${selectedFormatData.color}`} />
                <span className="text-sm font-medium text-gray-900">
                  {selectedFormatData.name} Preview
                </span>
              </div>
              <p className="text-sm text-gray-600">{selectedFormatData.description}</p>
              
              {selectedFormat === 'html' && (
                <div className="mt-3 text-xs text-gray-600">
                  ✓ Styled web page with charts<br/>
                  ✓ Print-friendly layout<br/>
                  ✓ Visual progress bars
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn-primary inline-flex items-center px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export as {selectedFormatData?.name}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;