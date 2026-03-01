import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SelectedObjectTabs() {
  return (
    <Tabs defaultValue="object" className="w-full h-full gap-2 p-2">
      <TabsList className="flex w-full">
        <TabsTrigger value="object">Object</TabsTrigger>
        <TabsTrigger value="material">Material</TabsTrigger>
      </TabsList>
      <TabsContent value="object" className="h-full">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Object Details</CardTitle>
            <CardDescription>
              View your key metrics and recent project activity. Track progress
              across all your active projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            You have 12 active projects and 3 pending tasks.
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="material">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Material</CardTitle>
            <CardDescription>
              Track performance and user engagement metrics. Monitor trends and
              identify growth opportunities.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Page views are up 25% compared to last month.
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
