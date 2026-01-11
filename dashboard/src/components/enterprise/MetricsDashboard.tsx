/**
 * Metrics Dashboard Component
 * Full metrics visualization with charts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select-advanced';
import type { MetricsData, Agent } from '../../types';
import { 
  BarChart3, 
  Clock, 
  MessageSquare, 
  Star, 
  TrendingUp,
  Users,
  RefreshCw,
  Loader2,
  AlertCircle,
  Tag,
  Timer,
} from 'lucide-react';

interface MetricsDashboardProps {
  className?: string;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ className }) => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams({
        from: dateFrom,
        to: dateTo,
      });
      if (selectedAgent !== 'all') {
        params.append('agentId', selectedAgent);
      }

      const response = await fetch(`/api/metrics?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data = await response.json();
      setMetrics(data.metrics);
    } catch (err) {
      setError('Error al cargar métricas');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, selectedAgent]);

  const fetchAgents = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/agents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const formatDuration = (ms: number) => {
    if (!ms || ms === 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      support: 'Soporte',
      billing: 'Facturación',
      bug: 'Bug/Error',
      feedback: 'Feedback',
      other: 'Otro',
    };
    return labels[category] || category;
  };

  if (isLoading && !metrics) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Métricas del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label htmlFor="dateFrom">Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateTo">Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label>Agente</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos los agentes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los agentes</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent._id} value={agent._id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchMetrics} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {metrics && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Chats</p>
                    <p className="text-3xl font-bold">{metrics.totalChats}</p>
                  </div>
                  <MessageSquare className="w-10 h-10 text-primary/20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tiempo Primera Respuesta</p>
                    <p className="text-3xl font-bold">{formatDuration(metrics.avgFirstResponseTime)}</p>
                  </div>
                  <Clock className="w-10 h-10 text-blue-500/20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Calificación Promedio</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold">{metrics.avgRating.toFixed(1)}</p>
                      <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                    </div>
                  </div>
                  <TrendingUp className="w-10 h-10 text-green-500/20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Cerrados por Inactividad</p>
                    <p className="text-3xl font-bold">{metrics.closedByInactivity}</p>
                  </div>
                  <Timer className="w-10 h-10 text-orange-500/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Chats by Agent */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Chats por Agente
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.chatsByAgent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos</p>
                ) : (
                  <div className="space-y-3">
                    {metrics.chatsByAgent.map((item) => (
                      <div key={item.agentId} className="flex items-center justify-between">
                        <span className="text-sm">{item.agentName}</span>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-2 bg-primary rounded"
                            style={{ 
                              width: `${Math.max(20, (item.count / Math.max(...metrics.chatsByAgent.map(a => a.count))) * 100)}px`
                            }}
                          />
                          <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rating Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Distribución de Calificaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.ratingDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin encuestas</p>
                ) : (
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const item = metrics.ratingDistribution.find(r => r.rating === rating);
                      const count = item?.count || 0;
                      const maxCount = Math.max(...metrics.ratingDistribution.map(r => r.count), 1);
                      return (
                        <div key={rating} className="flex items-center gap-2">
                          <div className="flex items-center w-20">
                            {[...Array(rating)].map((_, i) => (
                              <Star key={i} className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            ))}
                          </div>
                          <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                            <div 
                              className="h-full bg-yellow-500"
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Categorías
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.categoryDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin categorizar</p>
                ) : (
                  <div className="space-y-3">
                    {metrics.categoryDistribution.map((item) => (
                      <div key={item.category} className="flex items-center justify-between">
                        <span className="text-sm">{getCategoryLabel(item.category)}</span>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-2 bg-blue-500 rounded"
                            style={{ 
                              width: `${Math.max(20, (item.count / Math.max(...metrics.categoryDistribution.map(c => c.count))) * 100)}px`
                            }}
                          />
                          <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Peak Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Horas Pico
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.peakHours.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos</p>
                ) : (
                  <div className="flex items-end gap-1 h-32">
                    {[...Array(24)].map((_, hour) => {
                      const hourData = metrics.peakHours.find(h => h.hour === hour);
                      const count = hourData?.count || 0;
                      const maxCount = Math.max(...metrics.peakHours.map(h => h.count), 1);
                      const height = (count / maxCount) * 100;
                      return (
                        <div 
                          key={hour} 
                          className="flex-1 flex flex-col items-center"
                          title={`${hour}:00 - ${count} chats`}
                        >
                          <div 
                            className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                            style={{ height: `${Math.max(height, 2)}%` }}
                          />
                          {hour % 4 === 0 && (
                            <span className="text-[10px] text-muted-foreground mt-1">{hour}h</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default MetricsDashboard;
