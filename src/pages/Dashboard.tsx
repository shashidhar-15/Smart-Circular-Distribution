import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { getBlynkConfig, saveMessage, type BlynkMessage, type BlynkDevice } from '@/lib/blynk';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Send } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [sender, setSender] = useState('');
  const [devices, setDevices] = useState<BlynkDevice[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const config = getBlynkConfig();
    setDevices(config.devices);
    setIsConnected(config.devices.length > 0);
    
    if (config.devices.length === 0) {
      toast({
        title: "Setup Required",
        description: "Please configure Blynk connection first",
        variant: "destructive",
      });
    }
  }, []);

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDeviceIds(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const toggleAllDevices = () => {
    if (selectedDeviceIds.length === devices.length) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(devices.map(d => d.id));
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    if (selectedDeviceIds.length === 0) {
      toast({
        title: "No Devices Selected",
        description: "Please select at least one device",
        variant: "destructive",
      });
      return;
    }

    const selectedDevices = devices.filter(d => selectedDeviceIds.includes(d.id));
    if (selectedDevices.length === 0) {
      navigate('/setup');
      return;
    }

    setIsSending(true);
    try {
      const sendPromises = selectedDevices.map(device => 
        supabase.functions.invoke('blynk-proxy', {
          body: {
            authToken: device.authToken,
            method: 'GET',
            endpoint: `/update?token=${device.authToken}&${device.virtualPin}=${encodeURIComponent(message)}`,
          },
        })
      );

      const results = await Promise.allSettled(sendPromises);
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      selectedDevices.forEach(device => {
        const newMessage: BlynkMessage = {
          id: `${Date.now()}-${device.id}`,
          message,
          recipient: device.deviceName,
          sender: sender || 'Anonymous',
          timestamp: new Date(),
        };
        saveMessage(newMessage);
      });

      if (successCount > 0) {
        toast({
          title: "Messages Sent",
          description: `Message sent to ${successCount} device(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
        });
      }

      if (failCount > 0 && successCount === 0) {
        toast({
          title: "Send Failed",
          description: "Unable to send messages. Please check your connections.",
          variant: "destructive",
        });
      }

      setMessage('');
    } catch (error) {
      console.error('Send error:', error);
      toast({
        title: "Send Failed",
        description: "Unable to send message. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/10">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-28">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between animate-fade-in">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-2">Send messages to your classes</p>
            </div>
            <StatusBadge connected={isConnected} />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-hover border-2 border-primary/20 bg-gradient-card animate-fade-in hover:shadow-glow transition-all duration-300">
              <CardHeader className="bg-gradient-primary text-white rounded-t-lg">
                <CardTitle className="text-2xl">Send Message</CardTitle>
                <CardDescription className="text-white/90">Compose and send a message to a class</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Classes</Label>
                  <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center space-x-2 pb-2 border-b border-border">
                      <Checkbox 
                        id="all-classes"
                        checked={selectedDeviceIds.length === devices.length && devices.length > 0}
                        onCheckedChange={toggleAllDevices}
                      />
                      <label
                        htmlFor="all-classes"
                        className="text-sm font-semibold cursor-pointer select-none"
                      >
                        All Classes
                      </label>
                    </div>
                    {devices.map(device => (
                      <div key={device.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={device.id}
                          checked={selectedDeviceIds.includes(device.id)}
                          onCheckedChange={() => toggleDeviceSelection(device.id)}
                        />
                        <label
                          htmlFor={device.id}
                          className="text-sm font-medium cursor-pointer select-none"
                        >
                          {device.deviceName}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={8}
                  />
                </div>

                <Button
                  onClick={handleSendMessage}
                  disabled={isSending || !isConnected || selectedDeviceIds.length === 0}
                  className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300 h-12 text-lg font-semibold text-white"
                >
                  <Send className="w-5 h-5 mr-2" />
                  {isSending ? "Sending..." : `Send to ${selectedDeviceIds.length} Class${selectedDeviceIds.length !== 1 ? 'es' : ''}`}
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-hover border-2 border-accent/20 bg-gradient-card animate-fade-in hover:shadow-glow transition-all duration-300" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="bg-gradient-to-r from-accent to-primary text-white rounded-t-lg">
                <CardTitle className="text-2xl">Message Preview</CardTitle>
                <CardDescription className="text-white/90">How your message will appear</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">To:</span>
                    <span className="font-medium">
                      {selectedDeviceIds.length === 0 
                        ? 'No classes selected' 
                        : selectedDeviceIds.length === devices.length 
                        ? 'All Classes'
                        : devices.filter(d => selectedDeviceIds.includes(d.id))
                            .map(d => d.deviceName)
                            .join(', ')}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-1">Message:</p>
                    <p className="text-foreground whitespace-pre-wrap">
                      {message || 'Your message will appear here...'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
