import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Edit, Trash2, Mail, Phone, Calendar, Shield, MapPin, Activity, ListTree, UserPlus, User } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockActivityData = [
  { name: '周一', value: 12 },
  { name: '周二', value: 19 },
  { name: '周三', value: 3 },
  { name: '周四', value: 5 },
  { name: '周五', value: 2 },
  { name: '周六', value: 0 },
  { name: '周日', value: 0 },
];

export function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', name: '基本信息', icon: UserPlus },
    { id: 'permissions', name: '权限设置', icon: Shield },
    { id: 'activity', name: '活动日志', icon: Activity },
  ];

  // Dummy mock
  const user = {
    id: id || '1',
    name: '超级管理员',
    email: 'admin@mall.com',
    role: '超级管理员',
    status: '正常',
    lastLogin: '2 分钟前',
    phone: '+86 138 0000 0000',
    joinDate: '2023-01-01',
    location: '中国，北京',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/users')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">
              {user.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">{user.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                  {user.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{user.role} • 最后登录: {user.lastLogin}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-red-200 bg-red-50 rounded-lg text-sm font-medium text-red-600 hover:bg-red-100 transition-colors shadow-sm">
            <Trash2 className="w-4 h-4" />
            禁用账户
          </button>
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
            <Edit className="w-4 h-4" />
            编辑资料
          </button>
        </div>
      </div>

      <div className="flex space-x-1 border-b border-gray-200 w-full overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.name}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">联系信息</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">电子邮箱</p>
                      <p className="mt-1 text-gray-900">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">手机号码</p>
                      <p className="mt-1 text-gray-900">{user.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">所在地</p>
                      <p className="mt-1 text-gray-900">{user.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">加入时间</p>
                      <p className="mt-1 text-gray-900">{user.joinDate}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">账号安全</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="font-medium text-gray-900">登录密码</p>
                      <p className="text-sm text-gray-500 mt-1">建议定期更改密码以保证账号安全</p>
                    </div>
                    <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">修改密码</button>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="font-medium text-gray-900">双因素认证 (2FA)</p>
                      <p className="text-sm text-gray-500 mt-1">未开启双因素认证</p>
                    </div>
                    <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">去开启</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-500" />
                  活跃度趋势
                </h3>
                <div className="h-48 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockActivityData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                      <Tooltip />
                      <Area type="monotone" dataKey="value" stroke="#4F46E5" fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">当前角色与权限</h3>
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 mb-6">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-indigo-600" />
                <div>
                  <h4 className="font-medium text-indigo-900">{user.role}</h4>
                  <p className="text-sm text-indigo-700 mt-1">拥有系统所有功能的完整访问权限</p>
                </div>
              </div>
            </div>
            
            <h4 className="font-medium text-gray-900 mb-4">功能模块访问权限</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['控制台 (Dashboard)', '商品管理 (PMS)', '订单管理 (OMS)', '营销管理 (SMS)', '用户管理 (UMS)', '系统设置 (Settings)'].map((module, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <input type="checkbox" checked readOnly className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-600" />
                  <span className="text-sm text-gray-700">{module}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-medium">操作时间</th>
                  <th className="px-6 py-3 font-medium">操作动作</th>
                  <th className="px-6 py-3 font-medium">资源类型</th>
                  <th className="px-6 py-3 font-medium">IP地址</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-500">2023-10-24 10:30:22</td>
                  <td className="px-6 py-4 text-gray-900">更新商品</td>
                  <td className="px-6 py-4 font-medium text-indigo-600">PROD-001</td>
                  <td className="px-6 py-4 text-gray-500">192.168.1.1</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-500">2023-10-24 09:15:00</td>
                  <td className="px-6 py-4 text-gray-900">系统登录</td>
                  <td className="px-6 py-4 font-medium text-indigo-600">Authentication</td>
                  <td className="px-6 py-4 text-gray-500">192.168.1.1</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-500">2023-10-23 16:45:11</td>
                  <td className="px-6 py-4 text-gray-900">创建订单</td>
                  <td className="px-6 py-4 font-medium text-indigo-600">ORD-9005</td>
                  <td className="px-6 py-4 text-gray-500">192.168.1.1</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
