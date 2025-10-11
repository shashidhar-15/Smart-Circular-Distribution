import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { saveBlynkConfig, getBlynkConfig, type BlynkConfig } from '@/lib/blynk';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const BlynkSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [config, setConfig] = useState<BlynkConfig>({
    authToken: '',
    templateId: '',
    templateName: '',
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedConfig = getBlynkConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      setIsConnected(true);
    }
  }, []);

  const testConnection = async () => {
    if (!config.authToken || !config.templateId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('blynk-proxy', {
        body: {
          authToken: config.authToken,
          method: 'GET',
          endpoint: '/device/info',
        },
      });

      if (error) throw error;

      saveBlynkConfig(config);
      setIsConnected(true);
      toast({
        title: "Connection Successful",
        description: "Your Blynk device is connected!",
      });
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: "Unable to connect to Blynk. Please check your credentials.",
        variant: "destructive",
      });
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    saveBlynkConfig(config);
    toast({
      title: "Configuration Saved",
      description: "Your Blynk configuration has been saved.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-hover">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Blynk Cloud Setup</CardTitle>
                  <CardDescription>Configure your Blynk device connection</CardDescription>
                </div>
                <StatusBadge connected={isConnected} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="authToken">Auth Token</Label>
                <Input
                  id="authToken"
                  type="text"
                  placeholder="Enter your Blynk auth token"
                  value={config.authToken}
                  onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">
                  Your device authentication token from Blynk
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateId">Template ID</Label>
                <Input
                  id="templateId"
                  type="text"
                  placeholder="Enter template ID"
                  value={config.templateId}
                  onChange={(e) => setConfig({ ...config, templateId: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateName">Template Name</Label>
                <Input
                  id="templateName"
                  type="text"
                  placeholder="Enter template name"
                  value={config.templateName}
                  onChange={(e) => setConfig({ ...config, templateName: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={testConnection}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Testing..." : "Test Connection"}
                </Button>
                <Button
                  onClick={handleSave}
                  variant="secondary"
                  className="flex-1"
                >
                  Save Configuration
                </Button>
              </div>

              {isConnected && (
                <div className="pt-4 border-t">
                  <Button
                    onClick={() => navigate('/')}
                    className="w-full"
                  >
                    Go to Dashboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BlynkSetup;
