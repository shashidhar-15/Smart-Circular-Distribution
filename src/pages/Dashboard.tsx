import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBlynkConfig, saveMessage, updateMessageAcknowledgment, type BlynkMessage, type BlynkDevice } from '@/lib/blynk';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Send } from 'lucide-react';

// Store active polling intervals
const activePolls = new Map<string, NodeJS.Timeout>();

const startAcknowledgmentPolling = (messageId: string, devices: BlynkDevice[]) => {
  // Clear any existing poll for this message
  if (activePolls.has(messageId)) {
    clearInterval(activePolls.get(messageId));
  }

  let allAcknowledged = false;

  const pollInterval = setInterval(async () => {
    if (allAcknowledged) {
      clearInterval(pollInterval);
      activePolls.delete(messageId);
      return;
    }

    try {
      const ackPromises = devices.map(device =>
        supabase.functions.invoke('blynk-proxy', {
          body: {
            authToken: device.authToken,
            method: 'GET',
            endpoint: `/get?token=${device.authToken}&V3`,
          },
        }).then(result => ({
          deviceId: device.id,
          acknowledged: result.data?.data === '1' || result.data?.data === 1,
        }))
      );

      const ackResults = await Promise.all(ackPromises);
      
      ackResults.forEach(({ deviceId, acknowledged }) => {
        updateMessageAcknowledgment(messageId, deviceId, acknowledged);
      });

      // Check if all devices have acknowledged
      allAcknowledged = ackResults.every(r => r.acknowledged);

      // Dispatch custom event to notify Messages page of updates
      window.dispatchEvent(new CustomEvent('acknowledgment-updated'));
    } catch (error) {
      console.error('Error polling acknowledgments:', error);
    }
  }, 5000); // Poll every 5 seconds

  activePolls.set(messageId, pollInterval);

  // Clean up after 1 hour
  setTimeout(() => {
    if (activePolls.has(messageId)) {
      clearInterval(activePolls.get(messageId));
      activePolls.delete(messageId);
    }
  }, 3600000);
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [sender, setSender] = useState('');
  const [urgency, setUrgency] = useState<'0' | '1'>('0'); // 0 = normal, 1 = urgent
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

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    if (!sender.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a sender name",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDeviceId) {
      toast({
        title: "No Device Selected",
        description: "Please select a device",
        variant: "destructive",
      });
      return;
    }

    const isAllDevices = selectedDeviceId === 'all';
    const selectedDevices = isAllDevices 
      ? devices 
      : devices.filter(d => d.id === selectedDeviceId);
    
    if (selectedDevices.length === 0) {
      navigate('/setup');
      return;
    }

    setIsSending(true);
    try {
      // First, reset V3 (acknowledgment) to 0 for all devices
      const resetPromises = selectedDevices.map(device =>
        supabase.functions.invoke('blynk-proxy', {
          body: {
            authToken: device.authToken,
            method: 'GET',
            endpoint: `/update?token=${device.authToken}&V3=0`,
          },
        })
      );
      await Promise.all(resetPromises);

      // Send V0 (message) and V2 (urgency) first
      console.log(`[Blynk] Urgency value being sent: ${urgency} (${urgency === '1' ? 'URGENT' : 'NORMAL'})`);
      const sendMessagePromises = selectedDevices.map(device => {
        const endpoint = `/update?token=${device.authToken}&V0=${encodeURIComponent(message)}&V2=${urgency}`;
        console.log(`[Blynk] Sending V0+V2 to ${device.deviceName}:`, `https://blynk.cloud/external/api${endpoint}`);
        return supabase.functions.invoke('blynk-proxy', {
          body: {
            authToken: device.authToken,
            method: 'GET',
            endpoint,
          },
        });
      });

      // Wait for V0+V2 to complete first
      await Promise.all(sendMessagePromises);
      console.log('[Blynk] V0+V2 sent successfully');

      // Send V1 (sender) separately to ensure it updates - MUST be a separate call
      const sendSenderPromises = selectedDevices.map(device => {
        const endpoint = `/update?token=${device.authToken}&V1=${encodeURIComponent(sender)}`;
        console.log(`[Blynk] Sending V1 (sender="${sender}") to ${device.deviceName}:`, `https://blynk.cloud/external/api${endpoint}`);
        return supabase.functions.invoke('blynk-proxy', {
          body: {
            authToken: device.authToken,
            method: 'GET',
            endpoint,
          },
        });
      });

      const senderResults = await Promise.allSettled(sendSenderPromises);
      console.log('[Blynk] V1 sender results:', senderResults);
      
      const successCount = senderResults.filter(r => r.status === 'fulfilled').length;
      const failCount = senderResults.filter(r => r.status === 'rejected').length;

      // Save message with acknowledgment tracking
      const messageId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const deviceIds = selectedDevices.map(d => d.id);
      const acknowledgments: { [key: string]: boolean } = {};
      deviceIds.forEach(id => { acknowledgments[id] = false; });

      const newMessage: BlynkMessage = {
        id: messageId,
        message,
        recipient: isAllDevices ? 'All Classes' : selectedDevices[0].deviceName,
        sender: sender || 'Anonymous',
        timestamp: new Date(),
        deviceIds,
        acknowledgments,
      };
      saveMessage(newMessage);

      // Start polling for acknowledgments
      startAcknowledgmentPolling(messageId, selectedDevices);

      if (successCount > 0) {
        toast({
          title: isAllDevices ? "Messages Sent" : "Message Sent",
          description: isAllDevices 
            ? `Message sent to ${successCount} device(s)${failCount > 0 ? `, ${failCount} failed` : ''}`
            : "Your message has been sent successfully",
        });
      }

      if (failCount > 0 && successCount === 0) {
        toast({
          title: "Send Failed",
          description: "Unable to send message. Please check your connection.",
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
                  <Label htmlFor="device">Select Class</Label>
                  <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                    <SelectTrigger id="device">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {devices.map(device => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.deviceName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sender">Sender Name</Label>
                  <input
                    id="sender"
                    type="text"
                    placeholder="Enter your name..."
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urgency">Urgency Level</Label>
                  <Select value={urgency} onValueChange={(value) => setUrgency(value as '0' | '1')}>
                    <SelectTrigger id="urgency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Normal (2 sec beep)</SelectItem>
                      <SelectItem value="1">Urgent (double beep)</SelectItem>
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
                    rows={6}
                  />
                </div>

                <Button
                  onClick={handleSendMessage}
                  disabled={isSending || !isConnected || !selectedDeviceId}
                  className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300 h-12 text-lg font-semibold text-white"
                >
                  <Send className="w-5 h-5 mr-2" />
                  {isSending ? "Sending..." : "Send Message"}
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-hover border-2 border-accent/20 bg-gradient-card animate-fade-in hover:shadow-glow transition-all duration-300 mt-6" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="bg-gradient-to-r from-accent to-primary text-white rounded-t-lg">
                <CardTitle className="text-2xl">Message Preview</CardTitle>
                <CardDescription className="text-white/90">How your message will appear</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">To:</span>
                    <span className="font-medium">
                      {!selectedDeviceId 
                        ? 'No class selected' 
                        : selectedDeviceId === 'all'
                        ? 'All Classes'
                        : devices.find(d => d.id === selectedDeviceId)?.deviceName || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">From:</span>
                    <span className="font-medium">{sender || 'No sender'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Urgency:</span>
                    <span className={`font-medium ${urgency === '1' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {urgency === '1' ? 'Urgent' : 'Normal'}
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
