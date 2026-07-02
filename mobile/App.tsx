import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { api } from "./src/lib/api";
import { colors, fonts } from "./src/theme";
import type { RootStackParamList, TabParamList } from "./src/navigation";
import { LoginScreen } from "./src/screens/LoginScreen";
import { MeetingsScreen } from "./src/screens/MeetingsScreen";
import { MeetingDetailScreen } from "./src/screens/MeetingDetailScreen";
import { NewMeetingScreen } from "./src/screens/NewMeetingScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.listNotifications,
    refetchInterval: 15000,
  });
  const unread = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.slate50 },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.ink },
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.slate400,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="Meetings"
        component={MeetingsScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent500, fontFamily: fonts.bold },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.brand600} />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.slate50 },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.ink },
        headerTintColor: colors.brand600,
        contentStyle: { backgroundColor: colors.slate50 },
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="MeetingDetail"
        component={MeetingDetailScreen}
        options={{ title: "Meeting" }}
      />
      <Stack.Screen
        name="NewMeeting"
        component={NewMeetingScreen}
        options={{ title: "New meeting", presentation: "modal" }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationContainer>
          <Root />
          <StatusBar style="dark" />
        </NavigationContainer>
      </AuthProvider>
    </QueryClientProvider>
  );
}
