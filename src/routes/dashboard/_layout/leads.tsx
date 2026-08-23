import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useRequireCooperativa } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/_layout/leads")({
  component: LeadsPage,
});

type Lead = { id: string; name: string; whatsapp: string; crop: string; created_at: string };

function LeadsPage() {
  const cooperativa = useRequireCooperativa();
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("leads")
      .select("id, name, whatsapp, crop, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setLeads(data ?? []));
  }, []);

  if (!cooperativa) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads</CardTitle>
        <CardDescription>Quem preencheu o formulário da landing page</CardDescription>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lead ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Cultura</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.whatsapp}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{lead.crop}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
