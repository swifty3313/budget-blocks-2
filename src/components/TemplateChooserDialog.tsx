import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { FileText, DollarSign, Receipt, ArrowLeftRight, Settings } from "lucide-react";
import type { Block } from "@/types";
import { joinDisplayValues } from "@/lib/displayUtils";
import { ManageTemplatesDialog } from "@/components/ManageTemplatesDialog";

interface TemplateChooserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: Block) => void;
  bandTitle?: string;
}

export function TemplateChooserDialog({ 
  open, 
  onOpenChange, 
  onSelectTemplate,
  bandTitle 
}: TemplateChooserDialogProps) {
  const library = useStore((state) => state.library);
  const [showManage, setShowManage] = useState(false);

  const incomeTemplates = library.filter(t => t.type === 'Income');
  const fixedTemplates = library.filter(t => t.type === 'Fixed Bill');
  const flowTemplates = library.filter(t => t.type === 'Flow');

  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'Income': return DollarSign;
      case 'Fixed Bill': return Receipt;
      case 'Flow': return ArrowLeftRight;
      default: return FileText;
    }
  };

  const getBlockColor = (type: string) => {
    switch (type) {
      case 'Income': return 'text-success';
      case 'Fixed Bill': return 'text-warning';
      case 'Flow': return 'text-accent';
      default: return 'text-muted-foreground';
    }
  };

  const renderTemplateList = (templates: Block[]) => {
    if (templates.length === 0) {
      return (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No templates yet</p>
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {templates.map((template) => {
          const Icon = getBlockIcon(template.type);
          const color = getBlockColor(template.type);
          
          return (
            <Card 
              key={template.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                onSelectTemplate(template);
                onOpenChange(false);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Icon className={`w-5 h-5 mt-0.5 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1">{template.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {template.rows.length} row{template.rows.length !== 1 ? 's' : ''}
                        {template.rows.length > 0 && ` • ${joinDisplayValues([...new Set(template.rows.map(r => r.owner))])}`}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="ml-2">
                    Insert
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle>Insert from Template</DialogTitle>
                <DialogDescription>
                  {bandTitle ? `Choose a template to insert into ${bandTitle}` : 'Choose a template to insert'}
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowManage(true)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage
              </Button>
            </div>
          </DialogHeader>

        <Tabs defaultValue="income" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="income">
              Income
              {incomeTemplates.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {incomeTemplates.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="fixed">
              Fixed Bills
              {fixedTemplates.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {fixedTemplates.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="flow">
              Flow
              {flowTemplates.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {flowTemplates.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="income" className="mt-4">
            {renderTemplateList(incomeTemplates)}
          </TabsContent>

          <TabsContent value="fixed" className="mt-4">
            {renderTemplateList(fixedTemplates)}
          </TabsContent>

          <TabsContent value="flow" className="mt-4">
            {renderTemplateList(flowTemplates)}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    <ManageTemplatesDialog
      open={showManage}
      onOpenChange={setShowManage}
    />
  </>
  );
}
