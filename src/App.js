import React, { useState, useEffect } from 'react';
import { MapPin, Wifi, WifiOff, Users, Plus, Search, DollarSign, Clock } from 'lucide-react';

// Mock PouchDB functionality for demo (replace with actual PouchDB in production)
class MockPouchDB {
  constructor(name) {
    this.name = name;
    this.data = JSON.parse(localStorage.getItem(name) || '{}');
  }

  async put(doc) {
    const id = doc._id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    doc._id = id;
    doc._rev = `1-${Math.random().toString(36).substr(2, 9)}`;
    this.data[id] = doc;
    localStorage.setItem(this.name, JSON.stringify(this.data));
    return { ok: true, id, rev: doc._rev };
  }

  async allDocs(options = {}) {
    const docs = Object.values(this.data);
    return {
      total_rows: docs.length,
      rows: docs.map(doc => ({
        id: doc._id,
        key: doc._id,
        value: { rev: doc._rev },
        doc: options.include_docs ? doc : undefined
      }))
    };
  }

  async get(id) {
    const doc = this.data[id];
    if (!doc) throw new Error('Document not found');
    return doc;
  }
}

// Initialize database
const db = new MockPouchDB('water_distribution');

const WaterDistributionApp = () => {
  const [currentPage, setCurrentPage] = useState('onboarding');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [customers, setCustomers] = useState([]);
  const [syncStatus, setSyncStatus] = useState('idle');

  // Customer form state
  const [formData, setFormData] = useState({
    businessName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    geolocation: null
  });
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load customers on app start
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const result = await db.allDocs({ include_docs: true });
      const customerDocs = result.rows
        .filter(row => row.doc && row.doc.type === 'customer')
        .map(row => row.doc);
      setCustomers(customerDocs);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };
        setFormData(prev => ({ ...prev, geolocation: location }));
        setIsGettingLocation(false);
      },
      (error) => {
        let errorMessage = 'Unable to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        setLocationError(errorMessage);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const saveCustomer = async (e) => {
    e.preventDefault();
    
    if (!formData.geolocation) {
      alert('Please capture location before saving');
      return;
    }

    try {
      const customer = {
        ...formData,
        type: 'customer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: isOnline ? 'synced' : 'pending',
        balance: 0,
        totalDeliveries: 0
      };

      await db.put(customer);
      await loadCustomers();
      
      // Reset form
      setFormData({
        businessName: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        geolocation: null
      });

      alert('Customer saved successfully!');
      setCurrentPage('customers');
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error saving customer');
    }
  };

  const simulateSync = () => {
    setSyncStatus('syncing');
    setTimeout(() => {
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }, 2000);
  };

  // Onboarding Component
  const OnboardingPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">AquaTrack</h1>
          <p className="text-gray-600">Water Distribution Management</p>
        </div>
        
        <div className="space-y-4 mb-8">
          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
            <MapPin className="w-6 h-6 text-blue-500" />
            <span className="text-gray-700">Track customer locations</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
            <WifiOff className="w-6 h-6 text-green-500" />
            <span className="text-gray-700">Works offline</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
            <DollarSign className="w-6 h-6 text-purple-500" />
            <span className="text-gray-700">Manage receivables</span>
          </div>
        </div>
        
        <button
          onClick={() => setCurrentPage('form')}
          className="w-full bg-blue-500 text-white py-3 px-4 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
        >
          Get Started
        </button>
      </div>
    </div>
  );

  // Customer Form Component
  const CustomerForm = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">New Customer</h2>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person *
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address *
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Location *
              </label>
              
              {!formData.geolocation ? (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
                  >
                    <MapPin className="w-5 h-5" />
                    <span>{isGettingLocation ? 'Getting Location...' : 'Capture Location'}</span>
                  </button>
                  {locationError && (
                    <p className="text-red-600 text-sm mt-2">{locationError}</p>
                  )}
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-green-800 mb-2">
                    <MapPin className="w-5 h-5" />
                    <span className="font-medium">Location Captured</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Lat: {formData.geolocation.latitude.toFixed(6)}, 
                    Lng: {formData.geolocation.longitude.toFixed(6)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Accuracy: ±{Math.round(formData.geolocation.accuracy)}m
                  </p>
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="text-blue-600 text-sm hover:text-blue-800 mt-2"
                  >
                    Update Location
                  </button>
                </div>
              )}
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setCurrentPage('customers')}
                className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomer}
                className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
              >
                Save Customer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Customer List Component
  const CustomerList = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Customers ({customers.length})</h2>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                {isOnline ? 'Online' : 'Offline'}
              </div>
              
              {isOnline && (
                <button
                  onClick={simulateSync}
                  disabled={syncStatus === 'syncing'}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center space-x-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Sync'}</span>
                </button>
              )}
              
              <button
                onClick={() => setCurrentPage('form')}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Customer</span>
              </button>
            </div>
          </div>

          {customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No customers yet</p>
              <button
                onClick={() => setCurrentPage('form')}
                className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
              >
                Add Your First Customer
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {customers.map((customer) => (
                <div key={customer._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-800">{customer.businessName}</h3>
                      <p className="text-gray-600">{customer.contactPerson} • {customer.phone}</p>
                      <p className="text-sm text-gray-500">{customer.address}</p>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        customer.syncStatus === 'synced' 
                          ? 'bg-green-100 text-green-800'
                          : customer.syncStatus === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {customer.syncStatus}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Balance: $0.00
                      </p>
                      {customer.geolocation && (
                        <p className="text-xs text-gray-400 mt-1">
                          📍 {customer.geolocation.latitude.toFixed(4)}, {customer.geolocation.longitude.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render current page
  return (
    <div className="font-sans">
      {currentPage === 'onboarding' && <OnboardingPage />}
      {currentPage === 'form' && <CustomerForm />}
      {currentPage === 'customers' && <CustomerList />}
    </div>
  );
};

export default WaterDistributionApp;
