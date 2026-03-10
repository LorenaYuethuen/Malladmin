import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import type { Brand } from '../types/product';

export function BrandManager() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: '',
    websiteUrl: '',
  });

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ items: Brand[] }>('/brands');
      setBrands(response.items);
    } catch (error) {
      console.error('Failed to load brands:', error);
      alert('Failed to load brands');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        logoUrl: formData.logoUrl || undefined,
        websiteUrl: formData.websiteUrl || undefined,
      };

      if (editingBrand) {
        await apiClient.put(`/brands/${editingBrand.id}`, data);
        alert('Brand updated successfully');
      } else {
        await apiClient.post('/brands', data);
        alert('Brand created successfully');
      }
      
      resetForm();
      loadBrands();
    } catch (error) {
      console.error('Failed to save brand:', error);
      alert('Failed to save brand');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      description: brand.description || '',
      logoUrl: brand.logoUrl || '',
      websiteUrl: brand.websiteUrl || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this brand?')) return;
    
    try {
      setLoading(true);
      await apiClient.delete(`/brands/${id}`);
      alert('Brand deleted successfully');
      loadBrands();
    } catch (error) {
      console.error('Failed to delete brand:', error);
      alert('Failed to delete brand');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      logoUrl: '',
      websiteUrl: '',
    });
    setEditingBrand(null);
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Brand Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Brand'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingBrand ? 'Edit Brand' : 'Create Brand'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Website</label>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Logo URL</label>
              <input
                type="url"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingBrand ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        {loading && !showForm ? (
          <div className="p-6 text-center">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {brands.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 py-8">
                No brands found
              </div>
            ) : (
              brands.map(brand => (
                <div key={brand.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  {brand.logoUrl && (
                    <div className="mb-3 h-20 flex items-center justify-center bg-gray-50 rounded">
                      <img
                        src={brand.logoUrl}
                        alt={brand.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}
                  
                  <h3 className="font-semibold text-lg mb-2">{brand.name}</h3>
                  
                  {brand.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {brand.description}
                    </p>
                  )}
                  
                  {brand.websiteUrl && (
                    <a
                      href={brand.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline block mb-3"
                    >
                      Visit Website
                    </a>
                  )}
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleEdit(brand)}
                      className="flex-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(brand.id)}
                      className="flex-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
