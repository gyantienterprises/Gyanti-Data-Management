export default function NewEntry() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gyanti-text">ADD NEW DATA ENTRY</h2>
      
      <div className="bg-gyanti-sidebar p-6 rounded-lg shadow-inner space-y-4 max-w-2xl">
        {/* Simple labeled input example */}
        <div>
          <label htmlFor="clientName" className="block text-sm font-medium text-gyanti-textMuted mb-1">
            Client Name
          </label>
          <input
            id="clientName"
            type="text"
            placeholder="Enter client name"
            className="w-full p-3 border border-gray-700 bg-gyanti-input rounded-md text-gyanti-text placeholder-gyanti-textMuted focus:ring-2 focus:ring-gyanti-gold focus:border-gyanti-gold"
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gyanti-textMuted mb-1">
            Amount
          </label>
          <input
            id="amount"
            type="number"
            placeholder="0.00"
            className="w-full p-3 border border-gray-700 bg-gyanti-input rounded-md text-gyanti-text focus:ring-2 focus:ring-gyanti-gold focus:border-gyanti-gold"
          />
        </div>
        
        {/* Full width button using logo color */}
        <button className="w-full bg-gyanti-gold text-white font-semibold p-3 rounded-lg hover:bg-orange-500 transition-colors mt-4">
          Submit Entry
        </button>
      </div>
    </div>
  );
}