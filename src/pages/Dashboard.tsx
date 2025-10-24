import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBlynkConfig, saveMessage, type BlynkMessage, type BlynkDevice } from '@/lib/blynk';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Send } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [sender, setSender] = useState('');
  const [devices, setDevices] = useState<BlynkDevice[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const config = getBlynkConfig();
    setDevices(config.devices);
    setIsConnected(config.devices.length > 0);
    
    if (config.devices.length > 0) {
      setSelectedDeviceId(config.devices[0].id);
    } else {
      toast({
        title: "Setup Required",
        description: "Please configure Blynk connection first",
        variant: "destructive",
      });
    }
  }, []);

  const handleSendMessage = async () => {
    if (!message.trim() || !sender.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both message and sender name",
        variant: "destructive",
      });
      return;
    }

    const selectedDevice = devices.find(d => d.id === selectedDeviceId);
    if (!selectedDevice) {
      navigate('/setup');
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('blynk-proxy', {
        body: {
          authToken: selectedDevice.authToken,
          method: 'PUT',
          endpoint: `/update/${selectedDevice.virtualPin}`,
          data: { value: message },
        },
      });

      if (error) throw error;

      const newMessage: BlynkMessage = {
        id: Date.now().toString(),
        message,
        recipient: selectedDevice.deviceName,
        sender,
        timestamp: new Date(),
      };
      saveMessage(newMessage);

      toast({
        title: "Message Sent",
        description: `Message sent to ${selectedDevice.deviceName}`,
      });

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
    <div className="min-h-screen bg-gradient-subtle">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Send messages to your classes</p>
            </div>
            <StatusBadge connected={isConnected} />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Send Message</CardTitle>
                <CardDescription>Compose and send a message to a class</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sender">Your Name</Label>
                  <input
                    id="sender"
                    type="text"
                    placeholder="e.g., Prof. Smith"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipient">Select Device</Label>
                  <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a device" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map(device => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.deviceName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                  />
                </div>

                <Button
                  onClick={handleSendMessage}
                  disabled={isSending || !isConnected}
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isSending ? "Sending..." : "Send Message"}
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Message Preview</CardTitle>
                <CardDescription>How your message will appear</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">To:</span>
                    <span className="font-medium">
                      {devices.find(d => d.id === selectedDeviceId)?.deviceName || 'Select a device'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">From:</span>
                    <span className="font-medium">{sender || 'Not specified'}</span>
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
