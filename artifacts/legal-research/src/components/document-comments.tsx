import React, { useState } from 'react';
import { useListComments, useCreateComment, useDeleteComment, getListCommentsQueryKey } from '@workspace/api-client-react';
import { useUserContext } from '@/lib/user-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageSquare, Trash2, Send } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function DocumentComments({ documentId, documentName }: { documentId: number, documentName: string }) {
  const { role, canComment } = useUserContext();
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  
  const queryClient = useQueryClient();
  const { data: comments, isLoading } = useListComments({ documentId }, { query: { enabled: isOpen } });
  
  const createMutation = useCreateComment();
  const deleteMutation = useDeleteComment();

  const handlePost = () => {
    if (!content.trim()) return;
    createMutation.mutate({
      data: { documentId, content }
    }, {
      onSuccess: () => {
        setContent('');
        queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey({ documentId }) });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this comment?')) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey({ documentId }) });
        }
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <MessageSquare className="w-4 h-4 mr-2" /> Comments
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif">Notes: {documentName}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 min-h-[300px]">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2].map(i => <div key={i} className="h-16 bg-muted rounded-md" />)}
            </div>
          ) : comments?.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No notes or comments on this document yet.</p>
            </div>
          ) : (
            comments?.map(comment => (
              <div key={comment.id} className="bg-muted/30 p-3 rounded-md border text-sm group relative">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-foreground">{comment.authorName || 'User'}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                
                {role === 'owner' && (
                  <button 
                    onClick={() => handleDelete(comment.id)}
                    className="absolute top-2 right-2 p-1.5 bg-destructive/10 text-destructive rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {canComment && (
          <div className="pt-4 border-t mt-auto flex gap-2">
            <textarea
              className="flex-1 bg-background border border-input rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary h-20"
              placeholder="Add an internal note or observation..."
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            <Button 
              className="h-auto shrink-0 px-4" 
              onClick={handlePost}
              disabled={!content.trim() || createMutation.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
