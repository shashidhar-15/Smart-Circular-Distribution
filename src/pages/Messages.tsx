import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMessages, type BlynkMessage } from '@/lib/blynk';
import { Clock, User, Send } from 'lucide-react';

const Messages = () => {
  const [messages, setMessages] = useState<BlynkMessage[]>([]);

  useEffect(() => {
    setMessages(getMessages());
  }, []);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-28">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Message History</h1>
            <p className="text-muted-foreground mt-1">Recent messages sent to classes</p>
          </div>

          <div className="space-y-4">
            {messages.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-12 text-center">
                  <Send className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No messages sent yet</p>
                </CardContent>
              </Card>
            ) : (
              messages.map((msg) => (
                <Card key={msg.id} className="shadow-card hover:shadow-hover transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{msg.message}</CardTitle>
                        <CardDescription className="mt-2 space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Send className="w-3 h-3" />
                            <span>To: <span className="font-medium text-foreground">{msg.recipient}</span></span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-3 h-3" />
                            <span>From: <span className="font-medium text-foreground">{msg.sender}</span></span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(msg.timestamp)}</span>
                          </div>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;
