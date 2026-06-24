"use client";

import { useState } from "react";
import {
  createQuickCustomer,
  verifyCustomerByCardId,
  verifyCustomersByPhone,
} from "@/actions/customers";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface NotebookCustomerPickerProps {
  selectedCustomer: CustomerDTO | null;
  onSelect: (customer: CustomerDTO | null) => void;
}

export function NotebookCustomerPicker({
  selectedCustomer,
  onSelect,
}: NotebookCustomerPickerProps) {
  const [mode, setMode] = useState<"search" | "create">("search");
  const [cardId, setCardId] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [phoneMatches, setPhoneMatches] = useState<CustomerDTO[]>([]);

  const handleCardSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData();
    formData.set("cardId", cardId);
    const result = await verifyCustomerByCardId(formData);
    setIsLoading(false);
    if (result.success) {
      onSelect(result.data);
      return;
    }
    setError(result.error);
  };

  const handlePhoneSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPhoneMatches([]);
    setIsLoading(true);
    const formData = new FormData();
    formData.set("phone", phone);
    const result = await verifyCustomersByPhone(formData);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (result.data.length === 1) {
      onSelect(result.data[0]);
      return;
    }
    setPhoneMatches(result.data);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("phone", newPhone);
    const result = await createQuickCustomer(formData);
    setIsLoading(false);
    if (result.success) {
      onSelect(result.data);
      setMode("search");
      return;
    }
    setError(result.error);
  };

  if (selectedCustomer) {
    return (
      <Card>
        <CardTitle className="mb-2">Customer</CardTitle>
        <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
        <p className="text-sm text-gray-600">
          {selectedCustomer.cardId} · {selectedCustomer.phone}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {selectedCustomer.walletEnabled ? "Wallet enabled" : "Regular customer"}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => onSelect(null)}
        >
          Change customer
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle className="mb-4">Select Customer</CardTitle>
      <div className="mb-4 flex gap-2">
        <Button
          type="button"
          variant={mode === "search" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMode("search")}
        >
          Search
        </Button>
        <Button
          type="button"
          variant={mode === "create" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMode("create")}
        >
          Quick Customer
        </Button>
      </div>

      {mode === "search" ? (
        <div className="space-y-4">
          <form onSubmit={handleCardSearch} className="space-y-3">
            <Label htmlFor="nb-card-id">Card ID</Label>
            <Input
              id="nb-card-id"
              value={cardId}
              onChange={(e) => setCardId(e.target.value.toUpperCase())}
              placeholder="CP0001"
            />
            <Button type="submit" fullWidth disabled={isLoading}>
              Find by Card ID
            </Button>
          </form>
          <form onSubmit={handlePhoneSearch} className="space-y-3 border-t pt-4">
            <Label htmlFor="nb-phone">Phone</Label>
            <Input
              id="nb-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Registered phone"
            />
            <Button type="submit" variant="secondary" fullWidth disabled={isLoading}>
              Find by Phone
            </Button>
          </form>
          {phoneMatches.length > 1 && (
            <div className="space-y-2">
              {phoneMatches.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => onSelect(customer)}
                  className="w-full rounded-lg border p-3 text-left hover:border-emerald-600 hover:bg-emerald-50"
                >
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-gray-600">{customer.cardId}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <Label htmlFor="nb-name">Name</Label>
            <Input
              id="nb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="nb-new-phone">Phone (optional)</Label>
            <Input
              id="nb-new-phone"
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-500">
            Saved to the main customer database. Enable wallet from their profile
            later.
          </p>
          <Button type="submit" fullWidth disabled={isLoading}>
            Create & Select
          </Button>
        </form>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </Card>
  );
}
