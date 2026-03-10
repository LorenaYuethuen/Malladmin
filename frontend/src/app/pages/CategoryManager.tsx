import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import type { Category } from '../types/product';

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: '',
    sortOrder: '0',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ items: Category[] }>('/categories');
      setCategories(response?.items || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories([]);
      alert('Failed to load categories');
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
        parentId: formData.parentId || undefined,
        sortOrder: parseInt(formData.sortOrder),
      };

      if (editingCategory) {
        await apiClient.put(`/categories/${editingCategory.id}`, data);
        alert('Category updated successfully');
      } else {
        await apiClient.post('/categories', data);
        alert('Category created successfully');
      }
      
      resetForm();
      loadCategories();
    } catch (error) {
      console.error('Failed to save category:', error);
      alert('Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || '',
      sortOrder: category.sortOrder?.toString() || '0',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      setLoading(true);
      await apiClient.delete(`/categories/${id}`);
      alert('Category deleted successfully');
      loadCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('Failed to delete category');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      parentId: '',
      sortOrder: '0',
    });
    setEditingCategory(null);
    setShowForm(false);
  };

  const buildCategoryTree = (categories: Category[], parentId: string | null = null, level = 0): React.ReactElement[] => {
    return categories
      .filter(cat => cat.parentId === parentId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .flatMap(category => [
        <tr key={category.id} className="border-b hover:bg-gray-50">
          <td className="px-4 py-3" style={{ paddingLeft: `${level * 2 + 1}rem` }}>
            {level > 0 && <span className="text-gray-400 mr-2">└─</span>}
            {category.name}
          </td>
          <td className="px-4 py-3 text-gray-600">{category.description}</td>
          <td className="px-4 py-3 text-center">{category.sortOrder || 0}</td>
          <td className="px-4 py-3">
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(category)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(category.id)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </td>
        </tr>,
        ...buildCategoryTree(categories, category.id, level + 1)
      ]);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Category Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Category'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingCategory ? 'Edit Category' : 'Create Category'}
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
                <label className="block text-sm font-medium mb-1">Parent Category</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">None (Top Level)</option>
                  {categories
                    .filter(cat => !editingCategory || cat.id !== editingCategory.id)
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>
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

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Sort Order</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                min="0"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
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
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Description</th>
                <th className="px-4 py-3 text-center font-semibold">Sort Order</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No categories found
                  </td>
                </tr>
              ) : (
                buildCategoryTree(categories)
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
